const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined;

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
}

// Direct unsigned browser upload -- no backend involved, matching this
// app's Firebase client-SDK-only architecture. The cloud name + unsigned
// preset pair is Cloudinary's documented public, client-embeddable upload
// flow (same trust model as the Firebase web config).
export async function uploadToCloudinary(file: File): Promise<CloudinaryUploadResult> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error(
      "Cloudinary is not configured -- set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET."
    );
  }
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let reason = body;
    try {
      reason = JSON.parse(body)?.error?.message ?? body;
    } catch {
      // body wasn't JSON -- fall back to the raw text above
    }
    throw new Error(`Cloudinary upload failed: ${reason || res.statusText}`);
  }
  const data = await res.json();
  return { url: data.secure_url as string, publicId: data.public_id as string };
}

/** Rewrites a Cloudinary delivery URL to force a download instead of an inline navigation. */
export function cloudinaryDownloadUrl(url: string): string {
  const parts = url.split("/upload/");
  if (parts.length !== 2) return url;
  return `${parts[0]}/upload/fl_attachment/${parts[1]}`;
}
