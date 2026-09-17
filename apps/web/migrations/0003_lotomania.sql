insert into lotteries (slug, name, total_numbers, draw_size)
values ('lotomania', 'Lotomania', 100, 20)
on conflict (slug) do update set
  name = excluded.name,
  total_numbers = excluded.total_numbers,
  draw_size = excluded.draw_size,
  updated_at = now();
