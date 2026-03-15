-- Powietrze: demo seed data for Kraków
-- Intended for local development only.

INSERT INTO stations (id, source, name, city, latitude, longitude)
VALUES
  ('gios_krk_1', 'gios', 'Kraków, Aleja Krasińskiego', 'Kraków', 50.054, 19.931),
  ('gios_krk_2', 'gios', 'Kraków, ul. Bujaka', 'Kraków', 50.010, 19.955),
  ('gios_krk_3', 'gios', 'Kraków, os. Piastów', 'Kraków', 50.089, 20.012)
ON CONFLICT (id) DO NOTHING;

INSERT INTO readings (
  station_id,
  measured_at,
  pm25,
  pm10,
  no2,
  o3,
  so2,
  co,
  aqi_value,
  aqi_level
)
VALUES
  ('gios_krk_1', now() - interval '2 hours', 28, 45, 32, 40, 5, 0.8, 72, 'Umiarkowany'),
  ('gios_krk_1', now() - interval '1 hours', 22, 38, 26, 36, 4, 0.7, 64, 'Dobry'),
  ('gios_krk_1', now(),                     18, 30, 20, 32, 3, 0.6, 55, 'Dobry');

