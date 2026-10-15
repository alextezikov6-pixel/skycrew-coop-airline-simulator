import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";

const fetch = createStartHandler(defaultStreamHandler);

export default {
  async fetch(...args: Parameters<typeof fetch>) {
    try {
      return await fetch(...args);
    } catch (error) {
      console.error("Unhandled server request error:", error);
      throw error;
    }
  },
};
