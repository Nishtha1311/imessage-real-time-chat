import { create } from "zustand";
import { persist } from "zustand/middleware";
import toast from "react-hot-toast";

import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create(
  persist(
    (set, get) => ({
      users: [],
      conversations: [],
      messages: [],
      selectedUser: null,

      isConversationsLoading: false,
      isUsersLoading: false,
      isMessagesLoading: false,
      isSendingMedia: false,

      activeConversationId: null,
      searchQuery: "",
      sidebarTab: "chats",
      composerText: "",
      isSoundEnabled: true,

      // Fetch all users except the currently logged-in user
      getUsers: async () => {
        set({ isUsersLoading: true });

        try {
          const res = await axiosInstance.get("/messages/users");

          set((state) => ({
            users: res.data,
            selectedUser:
              state.selectedUser &&
              res.data.some((user) => user._id === state.selectedUser._id)
                ? state.selectedUser
                : state.selectedUser,
          }));
        } catch (error) {
          console.error("Error in getUsers:", error);
        } finally {
          set({ isUsersLoading: false });
        }
      },

      // Fetch users with whom the logged-in user already has conversations
      getConversations: async () => {
        set({ isConversationsLoading: true });

        try {
          const res = await axiosInstance.get("/messages/conversations");
          set({ conversations: res.data });
        } catch (error) {
          console.error("Error in getConversations:", error);
        } finally {
          set({ isConversationsLoading: false });
        }
      },

      // Fetch all messages between the logged-in user and selected user
      getMessages: async (userId, getToken) => {
  if (!userId) return;

  set({ isMessagesLoading: true });

  try {
    const token = await getToken();

    const res = await axiosInstance.get(`/messages/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    set({ messages: res.data });
  } catch (error) {
    console.error("Error in getMessages:", error);
    toast.error(error.response?.data?.message || "Failed to load messages");
  } finally {
    set({ isMessagesLoading: false });
  }
},

      // Send text message or media message with Clerk token
      sendMessage: async (messageData, getToken) => {
        const { selectedUser } = get();

        if (!selectedUser?._id) {
          toast.error("Please select a user first");
          return false;
        }

        try {
          const token = await getToken();

          const formData = new FormData();

          if (messageData.text?.trim()) {
            formData.append("text", messageData.text.trim());
          }

          if (messageData.file) {
            // Must match upload.single("file") in backend route
            formData.append("media", messageData.file);
          }

          const res = await axiosInstance.post(
            `/messages/send/${selectedUser._id}`,
            formData,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          set((state) => ({
            messages: [...state.messages, res.data],
            composerText: "",
          }));

          get().getConversations();

          return true;
        } catch (error) {
          console.error("Error in sendMessage:", error);
          toast.error(error.response?.data?.message || "Failed to send message");
          return false;
        }
      },

      // Send text from the message input
      sendTextMessage: async (conversationId, getToken) => {
        const messageText = get().composerText.trim();

        if (!conversationId || !messageText) return false;

        return get().sendMessage(
          {
            text: messageText,
          },
          getToken
        );
      },

      // Send selected image/video file
      sendMediaMessage: async ({ conversationId, file, getToken }) => {
        if (!conversationId || !file) return false;

        set({ isSendingMedia: true });

        try {
          return await get().sendMessage(
            {
              file,
            },
            getToken
          );
        } finally {
          set({ isSendingMedia: false });
        }
      },

      // Receive real-time messages through Socket.IO
      subscribeToMessages: (userId) => {
        if (!userId) return;

        const socket = useAuthStore.getState().socket;

        if (!socket) return;

        socket.off("newMessage");

        socket.on("newMessage", (newMessage) => {
          // Only add a real-time message if it was sent by the currently open user
          if (String(newMessage.senderId) !== String(userId)) return;

          set((state) => ({
            messages: [...state.messages, newMessage],
          }));

          get().getConversations();
        });
      },

      unsubscribeFromMessages: () => {
        const socket = useAuthStore.getState().socket;
        socket?.off("newMessage");
      },

      setSelectedUser: (selectedUser) => set({ selectedUser }),

      setActiveConversationId: (activeConversationId) => {
        set((state) => ({
          activeConversationId,
          selectedUser:
            state.users.find((user) => user._id === activeConversationId) ||
            state.conversations.find((user) => user._id === activeConversationId) ||
            null,
          messages: activeConversationId ? state.messages : [],
        }));
      },

      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setSidebarTab: (sidebarTab) => set({ sidebarTab }),
      setComposerText: (composerText) => set({ composerText }),
      setSoundEnabled: (isSoundEnabled) => set({ isSoundEnabled }),
    }),
    {
      name: "imessage-storage",
      partialize: (state) => ({
        isSoundEnabled: state.isSoundEnabled,
      }),
    }
  )
);