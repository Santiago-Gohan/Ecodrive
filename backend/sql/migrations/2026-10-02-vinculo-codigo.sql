-- Vinculación sencilla del dispositivo con el vehículo
--  * codigo_vinculo: código corto (6 caracteres) que el conductor escribe en la app
--    en lugar de copiar la API Key larga; también va dentro del código QR.
--  * vin: VIN leído por el adaptador ELM327 (PID 0900) para vincular automático.
--  * vinculo_por_placa: permite resolver el vehículo escribiendo solo la placa.

ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS codigo_vinculo varchar(12);
ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS vin varchar(20);
ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS vinculo_por_placa boolean NOT NULL DEFAULT false;

-- Código para los vehículos ya registrados (evita 0/O/I/Z para dictarlo bien)
UPDATE vehiculos
SET codigo_vinculo = upper(substr(regexp_replace(md5(placa || random()::text), '[0IOZ]', '', 'g'), 1, 6))
WHERE codigo_vinculo IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vehiculos_codigo ON vehiculos (codigo_vinculo);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehiculos_vin ON vehiculos (vin) WHERE vin IS NOT NULL;