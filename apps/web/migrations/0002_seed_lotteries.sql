insert into lotteries (slug, name, total_numbers, draw_size)
values
  ('dia-de-sorte', 'Dia de Sorte', 31, 7),
  ('mais-milionaria', '+Milionária', 50, 6),
  ('mega-sena', 'Mega-Sena', 60, 6),
  ('lotofacil', 'Lotofácil', 25, 15),
  ('quina', 'Quina', 80, 5)
on conflict (slug) do update set
  name = excluded.name,
  total_numbers = excluded.total_numbers,
  draw_size = excluded.draw_size,
  updated_at = now();
