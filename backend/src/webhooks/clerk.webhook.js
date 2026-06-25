import express from "express";
import User from "../models/user.model.js";
import { verifyWebhook } from "@clerk/backend/webhooks";

const router = express.Router();

router.post("/", async (req, res) => {
  console.log("========== WEBHOOK RECEIVED ==========");

  try {
    const signingSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;

    if (!signingSecret) {
      return res.status(503).json({
        message: "Webhook secret is not provided",
      });
    }

    const payload = Buffer.isBuffer(req.body)
      ? req.body.toString("utf8")
      : String(req.body);

    const request = new Request("http://internal/webhooks/clerk", {
      method: "POST",
      headers: new Headers(req.headers),
      body: payload,
    });

    const evt = await verifyWebhook(request, { signingSecret });

    console.log("Event type:", evt.type);
    console.dir(evt.data, { depth: null });

    if (evt.type === "user.created" || evt.type === "user.updated") {
      const u = evt.data;

      console.log("User id:", u.id);
      console.log("Emails:", u.email_addresses);

      const email =
        u.email_addresses?.find(
          (e) => e.id === u.primary_email_address_id
        )?.email_address ??
        u.email_addresses?.[0]?.email_address;

      const fullName =
        [u.first_name, u.last_name].filter(Boolean).join(" ") ||
        u.username ||
        email?.split("@")[0];

      console.log({
        clerkId: u.id,
        email,
        fullName,
        profilePic: u.image_url,
      });

      const savedUser = await User.findOneAndUpdate(
        { clerkId: u.id },
        {
          clerkId: u.id,
          email,
          fullName,
          profilePic: u.image_url,
        },
        {
          upsert: true,
          new: true,
          runValidators: true,
        }
      );

      console.log("Saved user:");
      console.log(savedUser);
    }

    if (evt.type === "user.deleted") {
      if (evt.data.id) {
        await User.findOneAndDelete({
          clerkId: evt.data.id,
        });
      }
    }

    return res.status(200).json({
      received: true,
    });
  } catch (error) {
    console.error("Error in Clerk webhook:", error);
    return res.status(400).json({
      message: "Webhook verification failed",
    });
  }
});

export default router;