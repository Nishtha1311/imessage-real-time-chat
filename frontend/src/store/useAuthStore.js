import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import { io } from "socket.io-client";

const BASE_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:5000"
    : import.meta.env.VITE_API_URL.replace("/api", "");

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isCheckingAuth: true,
  onlineUsers: [],
  socket: null,

  checkAuth: async (token) => {
    set({ isCheckingAuth: true });

    try {
      const res = await axiosInstance.get("/auth/check", {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

      set({ authUser: res.data });
      get().connectSocket(res.data);
    } catch (error) {
      console.error("Error in checkAuth:", error);
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  clearAuth: () => {
    get().disconnectSocket();
    set({ authUser: null, isCheckingAuth: false, onlineUsers: [] });
  },

  connectSocket: (user) => {
    if (!user || get().socket?.connected) return;

    const socket = io(BASE_URL, {
      query: { userId: user._id },
    });

    set({ socket });

    socket.on("getOnlineUsers", (userIds) => {
      set({ onlineUsers: userIds });
    });
  },

  disconnectSocket: () => {
    const socket = get().socket;

    if (socket?.connected) {
      socket.disconnect();
    }

    set({ socket: null });
  },
}));