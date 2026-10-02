// Turns the subcategory list the admin submits (the full list, in order) into
// the creates, updates and deletes that make the database match it.
import { MAX_SLUG_LENGTH, pickUnique, toSlug } from "./categoryNaming.js";
export const planSubcategoryChanges = (existing, submitted) => {
    const labels = submitted.map((s) => s.label.trim().toLowerCase());
    const repeated = submitted.find((s, i) => labels.indexOf(s.label.trim().toLowerCase()) !== i);
    if (repeated)
        return { ok: false, error: `Subcategory "${repeated.label.trim()}" is listed twice` };
    const existingById = new Map(existing.map((s) => [s.id, s]));
    const submittedIds = submitted.flatMap((s) => (s.id === undefined ? [] : [s.id]));
    if (submittedIds.some((id) => !existingById.has(id))) {
        return { ok: false, error: "A subcategory doesn't belong to this category (reload and try again)" };
    }
    if (new Set(submittedIds).size !== submittedIds.length) {
        return { ok: false, error: "A subcategory is listed twice" };
    }
    const kept = new Set(submittedIds);
    const takenSlugs = existing.filter((s) => kept.has(s.id)).map((s) => s.slug);
    const plan = {
        create: [],
        update: [],
        remove: existing.filter((s) => !kept.has(s.id)).map((s) => s.id),
    };
    submitted.forEach((s, index) => {
        const label = s.label.trim();
        const sortOrder = index + 1;
        if (s.id !== undefined) {
            plan.update.push({ id: s.id, label, sortOrder });
            return;
        }
        const slug = pickUnique(toSlug(label), takenSlugs, MAX_SLUG_LENGTH, "-");
        takenSlugs.push(slug);
        plan.create.push({ label, slug, sortOrder });
    });
    return { ok: true, plan };
};
