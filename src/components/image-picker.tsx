/**
 * ImagePicker — reusable image upload control backed by ImageKit.
 *
 * Replaces plain URL text inputs. Shows a preview, "Upload" button, and
 * a small "Use URL" fallback if the user prefers to paste a link.
 */
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { getImageKitAuth } from "@/lib/imagekit.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImagePlus, Loader2, X, Link as LinkIcon } from "lucide-react";

interface ImagePickerProps {
  value: string | null | undefined;
  onChange: (url: string) => void;
  folder?: string;
  className?: string;
  aspect?: "square" | "wide" | "auto";
  placeholder?: string;
}

export function ImagePicker({
  value,
  onChange,
  folder = "nextgen",
  className,
  aspect = "wide",
  placeholder = "No image selected",
}: ImagePickerProps) {
  const fetchAuth = useServerFn(getImageKitAuth);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showUrl, setShowUrl] = useState(false);

  const aspectClass =
    aspect === "square"
      ? "aspect-square"
      : aspect === "wide"
        ? "aspect-video"
        : "min-h-32";

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10 MB");
      return;
    }
    setUploading(true);
    try {
      const auth = await fetchAuth();
      const fd = new FormData();
      fd.append("file", file);
      fd.append("fileName", file.name);
      fd.append("folder", `/${folder}`);
      fd.append("useUniqueFileName", "true");
      fd.append("publicKey", auth.publicKey);
      fd.append("signature", auth.signature);
      fd.append("expire", String(auth.expire));
      fd.append("token", auth.token);

      const res = await fetch(
        "https://upload.imagekit.io/api/v1/files/upload",
        { method: "POST", body: fd },
      );
      const json = (await res.json()) as { url?: string; message?: string };
      if (!res.ok || !json.url) {
        throw new Error(json.message || "Upload failed");
      }
      onChange(json.url);
      toast.success("Image uploaded");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <div
        className={`relative rounded-lg border border-dashed border-border bg-muted/30 overflow-hidden ${aspectClass}`}
      >
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt=""
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute top-2 right-2 rounded-full bg-background/90 border p-1 hover:bg-background"
              aria-label="Remove image"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-sm text-muted-foreground gap-1">
            <ImagePlus className="h-6 w-6" />
            <span>{placeholder}</span>
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Uploading…
            </>
          ) : (
            <>
              <ImagePlus className="h-4 w-4 mr-1" />
              {value ? "Replace" : "Upload image"}
            </>
          )}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setShowUrl((v) => !v)}
        >
          <LinkIcon className="h-4 w-4 mr-1" />
          {showUrl ? "Hide URL" : "Use URL"}
        </Button>
      </div>
      {showUrl && (
        <Input
          className="mt-2"
          placeholder="https://…"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
