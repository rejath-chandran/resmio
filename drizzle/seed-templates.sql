-- Built-in templates. Ids match layout ids + resumes.template values (no data migration).
-- Re-runnable: INSERT OR IGNORE leaves admin edits to a seeded row alone.
-- is_active(1)/is_pro(0) and created_at/updated_at use their column defaults.
INSERT OR IGNORE INTO templates (id, name, description, layout, theme, sort_order) VALUES
('modern',    'Modern',    'Two-column with a tinted sidebar. Safe default for most roles.', 'modern',    '{"accent":"#3d67f1","ink":"#111827","font":"sans","density":"normal"}', 10),
('classic',   'Classic',   'Serif single column with ruled headings. Reads formal.',        'classic',   '{"accent":"#1f2937","ink":"#111827","font":"serif","density":"normal"}', 20),
('minimal',   'Minimal',   'Quiet single column, maximum whitespace.',                      'minimal',   '{"accent":"#374151","ink":"#1f2937","font":"sans","density":"airy"}', 30),
('sidebar',   'Sidebar',   'Dark contact rail against a light body. High contrast.',        'sidebar',   '{"accent":"#0f766e","ink":"#111827","font":"sans","density":"normal"}', 40),
('timeline',  'Timeline',  'Vertical rule with a date gutter. Shows career progression.',   'timeline',  '{"accent":"#b45309","ink":"#1f2937","font":"sans","density":"normal"}', 50),
('swiss',     'Swiss',     'Heavy type, geometric blocks, tight grid. Design-forward.',     'swiss',     '{"accent":"#dc2626","ink":"#111827","font":"sans","density":"tight"}', 60),
('elegant',   'Elegant',   'Centered serif header with hairline rules. Understated.',       'elegant',   '{"accent":"#7c3aed","ink":"#1f2937","font":"serif","density":"airy"}', 70),
('editorial', 'Editorial', 'Two-tone header band over a wide body. Magazine feel.',         'editorial', '{"accent":"#0369a1","ink":"#111827","font":"sans","density":"normal"}', 80);
