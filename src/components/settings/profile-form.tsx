"use client";

import { useActionState } from "react";
import { updateDisplayName, type ProfileState } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";

export function ProfileForm({ currentName }: { currentName: string | null }) {
  const [state, formAction, pending] = useActionState<ProfileState, FormData>(
    updateDisplayName,
    undefined
  );

  return (
    <form action={formAction} className="cd-auth-form" data-testid="profile-form" noValidate>
      {state?.message && (
        <div
          className="cd-auth-alert"
          role={state.success ? "status" : "alert"}
          data-testid={state.success ? "profile-success" : "profile-error"}
          style={
            state.success
              ? { borderColor: "var(--success)", color: "var(--success)" }
              : undefined
          }
        >
          <span>{state.message}</span>
        </div>
      )}

      <div className="cd-auth-field">
        <label htmlFor="name" className="cd-auth-label">
          Tên hiển thị
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          placeholder="Tên của bạn"
          defaultValue={currentName ?? ""}
          className="cd-auth-input"
          aria-invalid={state?.errors?.name ? "true" : undefined}
          aria-describedby={state?.errors?.name ? "name-error" : undefined}
        />
        {state?.errors?.name && (
          <p id="name-error" className="cd-auth-error" aria-live="polite">
            {state.errors.name[0]}
          </p>
        )}
      </div>

      <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
        {pending ? "Đang lưu…" : "Lưu"}
      </Button>
    </form>
  );
}
