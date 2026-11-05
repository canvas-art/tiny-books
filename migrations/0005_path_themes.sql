-- Which path theme each book is drawn with: a folder name in src/path/themes. NULL = the default theme.
ALTER TABLE books ADD COLUMN path_theme TEXT;
UPDATE books SET path_theme = 'roman' WHERE slug = 'meditations';
