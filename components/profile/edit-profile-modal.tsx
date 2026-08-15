"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, ImageIcon } from "lucide-react";
import { toast } from "sonner";

import type { Profile } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const schema = z.object({
  displayName: z.string().min(2, "At least 2 characters").max(40),
  handle: z
    .string()
    .min(3, "At least 3 characters")
    .max(24)
    .regex(/^[a-z0-9_]+$/i, "Letters, numbers, underscore only"),
  bio: z.string().max(200, "200 characters max").optional(),
});

type Values = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile;
  onSave: (patch: Partial<Profile>) => void;
}

export function EditProfileModal({ open, onOpenChange, profile, onSave }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: profile.displayName,
      handle: profile.handle,
      bio: profile.bio ?? "",
    },
  });

  const fileRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(
    profile.avatarUrl || null,
  );
  /** Set once an upload succeeds, so save sends the stored URL, not a blob. */
  const [uploadedUrl, setUploadedUrl] = React.useState<string | null>(null);

  /**
   * Upload immediately on pick, rather than on save.
   *
   * The picture is the one field where the user wants to see the result before
   * committing, and the endpoint persists it anyway, so deferring the upload to
   * the save button would mean holding a File in memory to gain nothing.
   */
  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Allow re-picking the same file after a failure: without this, choosing
    // the identical file fires no change event.
    e.target.value = "";
    if (!file) return;

    setUploadError(null);
    setUploading(true);

    // Show the local file straight away. Waiting on the round trip makes the
    // control feel broken on a slow connection.
    const localPreview = URL.createObjectURL(file);
    setAvatarPreview(localPreview);

    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/users/me/avatar", {
        method: "POST",
        credentials: "include",
        body,
      });
      const data = (await res.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null;

      if (!res.ok || !data?.url) {
        throw new Error(data?.error ?? "Upload failed. Try again.");
      }

      setAvatarPreview(data.url);
      setUploadedUrl(data.url);
      toast.success("Picture updated");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
      // Put the previous picture back so the preview never claims a change
      // that did not happen.
      setAvatarPreview(profile.avatarUrl || null);
    } finally {
      URL.revokeObjectURL(localPreview);
      setUploading(false);
    }
  }

  React.useEffect(() => {
    if (open) {
      setAvatarPreview(profile.avatarUrl || null);
      setUploadedUrl(null);
      setUploadError(null);
      reset({
        displayName: profile.displayName,
        handle: profile.handle,
        bio: profile.bio ?? "",
        });
    }
  }, [open, profile, reset]);

  async function onSubmit(values: Values) {
    // `onSave` PATCHes /api/users/me, so this is real. The 600ms sleep that
    // used to sit here was left over from the mock era and only made a working
    // save feel slower than it is.
    onSave({
      displayName: values.displayName,
      handle: values.handle,
      bio: values.bio ?? "",
      // Whatever the upload stored, falling back to what was there.
      avatarUrl: uploadedUrl ?? profile.avatarUrl,
    });
    toast.success("Profile updated");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>Change how you appear across EVO TV.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="displayName">Display name</Label>
            <Input id="displayName" {...register("displayName")} />
            {errors.displayName ? (
              <p className="text-xs text-red-400">{errors.displayName.message}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="handle">Handle</Label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">@</span>
              <Input id="handle" {...register("handle")} />
            </div>
            {errors.handle ? (
              <p className="text-xs text-red-400">{errors.handle.message}</p>
            ) : null}
          </div>
          {/* Pick a file, not paste a URL.
              "Avatar URL" assumed the user had already hosted the image
              somewhere and could produce a direct link. Nobody has one, and on
              a phone the picture is in the camera roll with no URL at all. */}
          <div className="space-y-1.5">
            <Label>Profile picture</Label>
            <div className="flex items-center gap-3">
              <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                {avatarPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarPreview}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <ImageIcon className="size-5 text-muted-foreground" />
                )}
                {uploading ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <Loader2 className="size-4 animate-spin text-foreground" />
                  </span>
                ) : null}
              </span>

              <div className="min-w-0 flex-1">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={onPickFile}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {avatarPreview ? "Change picture" : "Choose a picture"}
                </Button>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  JPG, PNG or WebP, up to 3.5 MB.
                </p>
              </div>
            </div>
            {uploadError ? (
              <p className="text-xs text-red-400">{uploadError}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" rows={3} {...register("bio")} />
            {errors.bio ? (
              <p className="text-xs text-red-400">{errors.bio.message}</p>
            ) : null}
          </div>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-sky-500 hover:bg-sky-500/90 text-black">
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
