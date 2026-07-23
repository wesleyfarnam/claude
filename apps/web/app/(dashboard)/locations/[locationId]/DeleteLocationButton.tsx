"use client";

import type { FormEvent } from "react";
import { deleteLocationForm } from "../actions";

export function DeleteLocationButton({ locationId }: { locationId: string }) {
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    const ok = window.confirm(
      "Delete this location? Devices will be unlinked (not deleted) and manager assignments will be removed. This cannot be undone.",
    );
    if (!ok) e.preventDefault();
  }

  return (
    <form action={deleteLocationForm} onSubmit={onSubmit}>
      <input type="hidden" name="id" value={locationId} />
      <button
        type="submit"
        className="rounded bg-maroon px-5 py-2.5 font-heading text-btn uppercase tracking-[1px] text-white shadow-sm hover:bg-maroon/90"
      >
        Delete location
      </button>
    </form>
  );
}
