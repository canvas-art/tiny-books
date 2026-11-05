-- Cover artwork. Public domain photo, see public/covers/CREDITS.md
ALTER TABLE books ADD COLUMN cover_image TEXT;
UPDATE books SET cover_image = '/covers/meditations.jpg' WHERE slug = 'meditations';
