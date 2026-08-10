import { del } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioAccess } from "@/lib/studio/auth";

export const runtime = "nodejs";

const deleteSchema = z.object({
  mediaId: z.string().uuid(),
  firstConfirmation: z.literal("I understand this cannot be undone"),
  keyword: z.literal("Purple50")
});

function isBlobPath(path: string) {
  return path.startsWith("incoming/") || path.startsWith("posters/");
}

export async function DELETE(request: Request) {
  const owner = await requireStudioAccess();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = deleteSchema.parse(await request.json());
    const { data: media, error: mediaError } = await owner.supabase
      .from("media_assets")
      .select("id,submission_id,storage_path,poster_path,mime_type,original_name")
      .eq("id", body.mediaId)
      .single();
    if (mediaError || !media) return NextResponse.json({ error: "Photo or video not found." }, { status: 404 });

    if (!media.mime_type.startsWith("image/") && !media.mime_type.startsWith("video/")) {
      return NextResponse.json({ error: "Only photographs and videos can be deleted here." }, { status: 400 });
    }

    const { data: submission } = await owner.supabase
      .from("submissions")
      .select("id")
      .eq("id", media.submission_id)
      .eq("project_id", owner.project.id)
      .single();
    if (!submission) return NextResponse.json({ error: "Photo or video not found." }, { status: 404 });

    const { data: deleted, error: deleteError } = await owner.supabase
      .from("media_assets")
      .delete()
      .eq("id", media.id)
      .select("id")
      .maybeSingle();
    if (deleteError) throw deleteError;
    if (!deleted) return NextResponse.json({ error: "Photo or video was not deleted." }, { status: 409 });

    const paths = [...new Set([media.storage_path, media.poster_path].filter((value): value is string => Boolean(value)))];
    const blobPaths = paths.filter(isBlobPath);
    const supabasePaths = paths.filter(path => !isBlobPath(path));
    const cleanupErrors: string[] = [];

    if (blobPaths.length) {
      try {
        const token = process.env.BLOB_READ_WRITE_TOKEN;
        if (!token) throw new Error("Blob storage is not configured.");
        await del(blobPaths, { token });
      } catch (error) {
        cleanupErrors.push(error instanceof Error ? error.message : "Blob cleanup failed.");
      }
    }

    if (supabasePaths.length) {
      const { error } = await owner.supabase.storage.from("sandi-memories").remove(supabasePaths);
      if (error) cleanupErrors.push(error.message);
    }

    if (cleanupErrors.length) {
      console.error("studio-media-delete-storage-cleanup", {
        mediaId: media.id,
        originalName: media.original_name,
        paths,
        errors: cleanupErrors
      });
    }

    return NextResponse.json({
      ok: true,
      deletedId: media.id,
      storageCleanupComplete: cleanupErrors.length === 0
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Both confirmations are required. Type Purple50 exactly." }, { status: 400 });
    }
    return NextResponse.json({
      error: error instanceof Error ? error.message : "The photo or video could not be deleted."
    }, { status: 500 });
  }
}
