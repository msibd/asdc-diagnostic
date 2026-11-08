-- Editable menu labels, section headings, feature cards, footer note and Facebook link of the public website.
-- Stores only what the clinic changed; the website falls back to its built-in wording for the rest.
ALTER TABLE "ClinicContent" ADD COLUMN "layout" JSONB;
