"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
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
  avatarUrl: z.string().url("Must be a valid URL").or(z.literal("")).optional(),
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
      avatarUrl: profile.avatarUrl ?? "",
    },
  });

  React.useEffect(() => {
    if (open) {
      reset({
        displayName: profile.displayName,
        handle: profile.handle,
        bio: profile.bio ?? "",
        avatarUrl: profile.avatarUrl ?? "",
      });
    }
  }, [open, profile, reset]);

  async function onSubmit(values: Values) {
    await new Promise((r) => setTimeout(r, 600));
    onSave({
      displayName: values.displayName,
      handle: values.handle,
      bio: values.bio ?? "",
      avatarUrl: values.avatarUrl || profile.avatarUrl,
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
              <span className="text-neutral-500">@</span>
              <Input id="handle" {...register("handle")} />
            </div>
            {errors.handle ? (
              <p className="text-xs text-red-400">{errors.handle.message}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="avatarUrl">Avatar URL</Label>
            <Input
              id="avatarUrl"
              placeholder="https://..."
              {...register("avatarUrl")}
            />
            {errors.avatarUrl ? (
              <p className="text-xs text-red-400">{errors.avatarUrl.message}</p>
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
