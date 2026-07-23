/**
 * ImageKit authentication for client-side uploads.
 *
 * The browser calls `getImageKitAuth()` before uploading; it returns
 * a signed token + expire + signature plus the public key and URL endpoint
 * so the client can POST directly to ImageKit.
 */
import { createServerFn } from "@tanstack/react-start";

export const getImageKitAuth = createServerFn({ method: "GET" }).handler(
  async () => {
    const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;

    if (!publicKey || !privateKey || !urlEndpoint) {
      throw new Response(
        "ImageKit is not configured. Set IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY and IMAGEKIT_URL_ENDPOINT.",
        { status: 500 },
      );
    }

    const { createHmac, randomUUID } = await import("crypto");
    const token = randomUUID();
    const expire = Math.floor(Date.now() / 1000) + 60 * 10; // 10 min
    const signature = createHmac("sha1", privateKey)
      .update(token + expire)
      .digest("hex");

    return {
      token,
      expire,
      signature,
      publicKey,
      urlEndpoint,
    };
  },
);
