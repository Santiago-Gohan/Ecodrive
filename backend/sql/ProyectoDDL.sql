-- ============================================================
-- ProyectoDDL.sql  ·  EcoDrive
-- Script DDL completo (CREATE TABLE) del proyecto.
-- Base destino: ProyectoDDL   ·   Motor: PostgreSQL 16
-- 26 tablas: flota, telemetria, mantenimiento, taller/inventario,
-- RBAC/usuarios, notificaciones, webhooks/API, privacidad, hardware.
--
-- Uso:
--   1) Crear la base:  CREATE DATABASE "ProyectoDDL";
--   2) Cargar este script:
--      psql -h localhost -U postgres -d "ProyectoDDL" -f ProyectoDDL.sql
--
-- Generado con: pg_dump --schema-only --no-owner --no-privileges
-- ============================================================
--
-- PostgreSQL database dump
--


-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--



SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alerta_mantenimiento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alerta_mantenimiento (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vehiculo_id uuid NOT NULL,
    tipo_alerta character varying(50) NOT NULL,
    severidad character varying(20) NOT NULL,
    estado character varying(20) NOT NULL,
    fecha_generacion timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT alerta_mantenimiento_estado_check CHECK (((estado)::text = ANY ((ARRAY['PENDIENTE'::character varying, 'ACTIVA'::character varying, 'ATENDIDA'::character varying])::text[])))
);


--
-- Name: api_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre character varying(120) NOT NULL,
    token character varying(80) NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    ultimo_uso timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario character varying(60),
    ip character varying(60),
    recurso character varying(120),
    accion character varying(60),
    detalles jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: consentimientos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consentimientos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo character varying(30) DEFAULT 'PRIVACIDAD'::character varying NOT NULL,
    version character varying(20) NOT NULL,
    identificador character varying(150) NOT NULL,
    aceptado boolean DEFAULT true NOT NULL,
    ip character varying(60),
    user_agent character varying(300),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT consentimientos_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['PRIVACIDAD'::character varying, 'MARKETING'::character varying, 'TERMINOS'::character varying])::text[])))
);


--
-- Name: dispositivos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dispositivos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vehiculo_id uuid,
    tipo character varying(20) DEFAULT 'GPS_FIJO'::character varying NOT NULL,
    imei character varying(40),
    modelo character varying(80),
    fabricante character varying(80),
    protocolo character varying(40) DEFAULT 'HTTP_GENERICO'::character varying NOT NULL,
    api_key character varying(64) NOT NULL,
    sim_msisdn character varying(40),
    ultimo_ping timestamp with time zone,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT dispositivos_protocolo_check CHECK (((protocolo)::text = ANY ((ARRAY['HTTP_GENERICO'::character varying, 'JT808'::character varying, 'TELTONIKA'::character varying, 'MEITRACK'::character varying])::text[]))),
    CONSTRAINT dispositivos_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['GPS_FIJO'::character varying, 'OBD_BT'::character varying, 'TELEFONO'::character varying])::text[])))
);


--
-- Name: eventos_viales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eventos_viales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo character varying(20) NOT NULL,
    lat double precision NOT NULL,
    lng double precision NOT NULL,
    descripcion character varying(300),
    placa character varying(20),
    vehiculo_id uuid,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT eventos_viales_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['POLICIA'::character varying, 'ACCIDENTE'::character varying, 'RETEN'::character varying, 'OBRA'::character varying, 'OTRO'::character varying])::text[])))
);


--
-- Name: mantenimientos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mantenimientos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vehiculo_id uuid NOT NULL,
    fecha date NOT NULL,
    descripcion text,
    costo numeric(12,2),
    odometro integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: movimientos_inventario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.movimientos_inventario (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    repuesto_id uuid NOT NULL,
    tipo character varying(20) NOT NULL,
    cantidad numeric(12,3) NOT NULL,
    costo_unitario numeric(12,2),
    motivo character varying(200),
    orden_id uuid,
    usuario character varying(60),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT movimientos_inventario_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['ENTRADA'::character varying, 'SALIDA'::character varying, 'AJUSTE'::character varying])::text[])))
);


--
-- Name: notificacion_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notificacion_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    canal character varying(20) NOT NULL,
    evento character varying(40) NOT NULL,
    destinatarios character varying(500),
    params jsonb DEFAULT '{}'::jsonb NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notificacion_config_canal_check CHECK (((canal)::text = ANY ((ARRAY['WHATSAPP'::character varying, 'EMAIL'::character varying, 'SMS'::character varying, 'WEBHOOK'::character varying])::text[]))),
    CONSTRAINT notificacion_config_evento_check CHECK (((evento)::text = ANY ((ARRAY['ALERTA_TERMICA'::character varying, 'ALERTA_MANTENIMIENTO'::character varying, 'EVENTO_VIAL'::character varying, 'OPINION'::character varying])::text[])))
);


--
-- Name: notificacion_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notificacion_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    canal character varying(20) NOT NULL,
    evento character varying(40) NOT NULL,
    destino character varying(500),
    asunto character varying(200),
    mensaje text,
    estado character varying(20) DEFAULT 'PENDIENTE'::character varying NOT NULL,
    error text,
    vehiculo_id uuid,
    alerta_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notificacion_log_estado_check CHECK (((estado)::text = ANY ((ARRAY['PENDIENTE'::character varying, 'ENVIADO'::character varying, 'ERROR'::character varying, 'SIN_PROVEEDOR'::character varying])::text[])))
);


--
-- Name: opiniones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.opiniones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rol character varying(60),
    temas character varying(200),
    comentario text,
    nombre character varying(80),
    contacto character varying(120),
    estado character varying(20) DEFAULT 'PENDIENTE'::character varying NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    revisado_en timestamp with time zone,
    CONSTRAINT opiniones_estado_check CHECK (((estado)::text = ANY ((ARRAY['PENDIENTE'::character varying, 'APROBADA'::character varying, 'RECHAZADA'::character varying])::text[])))
);


--
-- Name: orden_repuestos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orden_repuestos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    orden_id uuid NOT NULL,
    repuesto_id uuid,
    descripcion character varying(200) NOT NULL,
    cantidad numeric(12,3) DEFAULT 1 NOT NULL,
    costo_unitario numeric(12,2) DEFAULT 0 NOT NULL,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ordenes_trabajo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ordenes_trabajo (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo character varying(30) NOT NULL,
    vehiculo_id uuid NOT NULL,
    tipo character varying(20) DEFAULT 'PREVENTIVO'::character varying NOT NULL,
    estado character varying(25) DEFAULT 'ABIERTA'::character varying NOT NULL,
    prioridad character varying(10) DEFAULT 'MEDIA'::character varying NOT NULL,
    descripcion text,
    mecanico character varying(60),
    sede character varying(120),
    odometro integer,
    fecha_apertura timestamp with time zone DEFAULT now() NOT NULL,
    fecha_cierre timestamp with time zone,
    costo_mano_obra numeric(12,2) DEFAULT 0 NOT NULL,
    costo_repuestos numeric(12,2) DEFAULT 0 NOT NULL,
    costo_total numeric(12,2) DEFAULT 0 NOT NULL,
    mantenimiento_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ordenes_trabajo_estado_check CHECK (((estado)::text = ANY ((ARRAY['ABIERTA'::character varying, 'EN_PROCESO'::character varying, 'ESPERA_REPUESTOS'::character varying, 'CERRADA'::character varying, 'CANCELADA'::character varying])::text[]))),
    CONSTRAINT ordenes_trabajo_prioridad_check CHECK (((prioridad)::text = ANY ((ARRAY['BAJA'::character varying, 'MEDIA'::character varying, 'ALTA'::character varying, 'URGENTE'::character varying])::text[]))),
    CONSTRAINT ordenes_trabajo_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['PREVENTIVO'::character varying, 'CORRECTIVO'::character varying, 'PREDICTIVO'::character varying])::text[])))
);


--
-- Name: permisos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permisos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recurso character varying(60) NOT NULL,
    accion character varying(40) NOT NULL,
    clave_permiso character varying(120) NOT NULL,
    descripcion character varying(200),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: repuestos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.repuestos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo character varying(60) NOT NULL,
    nombre character varying(120) NOT NULL,
    descripcion character varying(300),
    categoria character varying(60),
    unidad character varying(20) DEFAULT 'UND'::character varying NOT NULL,
    stock_actual numeric(12,3) DEFAULT 0 NOT NULL,
    stock_minimo numeric(12,3) DEFAULT 0 NOT NULL,
    costo_unitario numeric(12,2) DEFAULT 0 NOT NULL,
    ubicacion character varying(80),
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rol_permiso; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rol_permiso (
    rol_id uuid NOT NULL,
    permiso_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre character varying(40) NOT NULL,
    descripcion character varying(200),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    nombre text NOT NULL,
    aplicado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: solicitudes_datos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.solicitudes_datos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo character varying(20) NOT NULL,
    identificador character varying(150) NOT NULL,
    descripcion text,
    estado character varying(20) DEFAULT 'PENDIENTE'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resuelto_en timestamp with time zone,
    CONSTRAINT solicitudes_datos_estado_check CHECK (((estado)::text = ANY ((ARRAY['PENDIENTE'::character varying, 'EN_PROCESO'::character varying, 'RESUELTA'::character varying, 'RECHAZADA'::character varying])::text[]))),
    CONSTRAINT solicitudes_datos_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['ACCESO'::character varying, 'RECTIFICACION'::character varying, 'ELIMINACION'::character varying, 'OPOSICION'::character varying])::text[])))
);


--
-- Name: telemetria_lectura; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.telemetria_lectura (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vehiculo_id uuid NOT NULL,
    ect_temperatura numeric(6,2) NOT NULL,
    rpm integer NOT NULL,
    fecha_registro timestamp without time zone DEFAULT now() NOT NULL,
    nivel_combustible numeric(5,2),
    lat double precision,
    lng double precision
);


--
-- Name: telemetria_manual; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.telemetria_manual (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vehiculo_id uuid NOT NULL,
    odometro_km numeric(12,3),
    nivel_combustible numeric(5,2),
    lat double precision,
    lng double precision,
    notas character varying(300),
    creado_por character varying(60),
    fecha_registro timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: telemetria_resumen; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.telemetria_resumen (
    vehiculo_id uuid NOT NULL,
    hora timestamp with time zone NOT NULL,
    lecturas integer DEFAULT 1 NOT NULL,
    ect_min numeric(6,2),
    ect_max numeric(6,2),
    ect_prom numeric(8,2),
    rpm_max integer,
    combustible_prom numeric(5,2)
);


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    username character varying(60) NOT NULL,
    password_hash character varying(255),
    email character varying(150),
    nombre character varying(120),
    rol_id uuid,
    sede character varying(120),
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    telefono character varying(40),
    ultimo_acceso timestamp with time zone,
    debe_cambiar_password boolean DEFAULT false NOT NULL
);


--
-- Name: vehiculos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehiculos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    placa character varying(20) NOT NULL,
    api_key character varying(64) NOT NULL,
    nombre character varying(100),
    activo boolean DEFAULT true NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL,
    marca character varying(60),
    modelo character varying(60),
    anio integer,
    combustible character varying(10),
    tipo_vehiculo character varying(15) DEFAULT 'CARRO'::character varying,
    ultimo_mantenimiento date,
    intervalo_mantenimiento integer DEFAULT 180 NOT NULL,
    plan_mantenimiento text,
    proximo_mantenimiento date,
    codigo_vinculo character varying(12),
    vin character varying(20),
    vinculo_por_placa boolean DEFAULT false NOT NULL,
    tipo_conexion character varying(20) DEFAULT 'OBD'::character varying NOT NULL,
    permite_lectura_manual boolean DEFAULT false NOT NULL,
    origen_datos character varying(20) DEFAULT 'MOVIL'::character varying,
    CONSTRAINT vehiculos_tipo_conexion_check CHECK (((tipo_conexion)::text = ANY ((ARRAY['OBD'::character varying, 'GPS_SOLO'::character varying, 'GPS_FIJO'::character varying, 'MANUAL'::character varying])::text[])))
);


--
-- Name: webhook_entregas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_entregas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    webhook_id uuid NOT NULL,
    evento character varying(60) NOT NULL,
    payload jsonb NOT NULL,
    estado character varying(20) DEFAULT 'PENDIENTE'::character varying NOT NULL,
    intentos integer DEFAULT 0 NOT NULL,
    http_status integer,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    enviado_en timestamp with time zone,
    CONSTRAINT webhook_entregas_estado_check CHECK (((estado)::text = ANY ((ARRAY['PENDIENTE'::character varying, 'ENVIADO'::character varying, 'ERROR'::character varying])::text[])))
);


--
-- Name: webhooks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhooks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre character varying(120) NOT NULL,
    url character varying(500) NOT NULL,
    eventos character varying(300) DEFAULT ''::character varying NOT NULL,
    secreto character varying(120),
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: alerta_mantenimiento alerta_mantenimiento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerta_mantenimiento
    ADD CONSTRAINT alerta_mantenimiento_pkey PRIMARY KEY (id);


--
-- Name: api_tokens api_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_tokens
    ADD CONSTRAINT api_tokens_pkey PRIMARY KEY (id);


--
-- Name: api_tokens api_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_tokens
    ADD CONSTRAINT api_tokens_token_key UNIQUE (token);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: consentimientos consentimientos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consentimientos
    ADD CONSTRAINT consentimientos_pkey PRIMARY KEY (id);


--
-- Name: dispositivos dispositivos_api_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispositivos
    ADD CONSTRAINT dispositivos_api_key_key UNIQUE (api_key);


--
-- Name: dispositivos dispositivos_imei_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispositivos
    ADD CONSTRAINT dispositivos_imei_key UNIQUE (imei);


--
-- Name: dispositivos dispositivos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispositivos
    ADD CONSTRAINT dispositivos_pkey PRIMARY KEY (id);


--
-- Name: eventos_viales eventos_viales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos_viales
    ADD CONSTRAINT eventos_viales_pkey PRIMARY KEY (id);


--
-- Name: mantenimientos mantenimientos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mantenimientos
    ADD CONSTRAINT mantenimientos_pkey PRIMARY KEY (id);


--
-- Name: movimientos_inventario movimientos_inventario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_inventario
    ADD CONSTRAINT movimientos_inventario_pkey PRIMARY KEY (id);


--
-- Name: notificacion_config notificacion_config_canal_evento_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificacion_config
    ADD CONSTRAINT notificacion_config_canal_evento_key UNIQUE (canal, evento);


--
-- Name: notificacion_config notificacion_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificacion_config
    ADD CONSTRAINT notificacion_config_pkey PRIMARY KEY (id);


--
-- Name: notificacion_log notificacion_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificacion_log
    ADD CONSTRAINT notificacion_log_pkey PRIMARY KEY (id);


--
-- Name: opiniones opiniones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opiniones
    ADD CONSTRAINT opiniones_pkey PRIMARY KEY (id);


--
-- Name: orden_repuestos orden_repuestos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orden_repuestos
    ADD CONSTRAINT orden_repuestos_pkey PRIMARY KEY (id);


--
-- Name: ordenes_trabajo ordenes_trabajo_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_trabajo
    ADD CONSTRAINT ordenes_trabajo_codigo_key UNIQUE (codigo);


--
-- Name: ordenes_trabajo ordenes_trabajo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_trabajo
    ADD CONSTRAINT ordenes_trabajo_pkey PRIMARY KEY (id);


--
-- Name: permisos permisos_clave_permiso_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_clave_permiso_key UNIQUE (clave_permiso);


--
-- Name: permisos permisos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permisos
    ADD CONSTRAINT permisos_pkey PRIMARY KEY (id);


--
-- Name: repuestos repuestos_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repuestos
    ADD CONSTRAINT repuestos_codigo_key UNIQUE (codigo);


--
-- Name: repuestos repuestos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repuestos
    ADD CONSTRAINT repuestos_pkey PRIMARY KEY (id);


--
-- Name: rol_permiso rol_permiso_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rol_permiso
    ADD CONSTRAINT rol_permiso_pkey PRIMARY KEY (rol_id, permiso_id);


--
-- Name: roles roles_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key UNIQUE (nombre);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (nombre);


--
-- Name: solicitudes_datos solicitudes_datos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_datos
    ADD CONSTRAINT solicitudes_datos_pkey PRIMARY KEY (id);


--
-- Name: telemetria_lectura telemetria_lectura_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telemetria_lectura
    ADD CONSTRAINT telemetria_lectura_pkey PRIMARY KEY (id);


--
-- Name: telemetria_manual telemetria_manual_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telemetria_manual
    ADD CONSTRAINT telemetria_manual_pkey PRIMARY KEY (id);


--
-- Name: telemetria_resumen telemetria_resumen_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telemetria_resumen
    ADD CONSTRAINT telemetria_resumen_pkey PRIMARY KEY (vehiculo_id, hora);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_username_key UNIQUE (username);


--
-- Name: vehiculos vehiculos_api_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehiculos
    ADD CONSTRAINT vehiculos_api_key_key UNIQUE (api_key);


--
-- Name: vehiculos vehiculos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehiculos
    ADD CONSTRAINT vehiculos_pkey PRIMARY KEY (id);


--
-- Name: vehiculos vehiculos_placa_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehiculos
    ADD CONSTRAINT vehiculos_placa_key UNIQUE (placa);


--
-- Name: webhook_entregas webhook_entregas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_entregas
    ADD CONSTRAINT webhook_entregas_pkey PRIMARY KEY (id);


--
-- Name: webhooks webhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhooks
    ADD CONSTRAINT webhooks_pkey PRIMARY KEY (id);


--
-- Name: idx_alertas_vehiculo_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alertas_vehiculo_estado ON public.alerta_mantenimiento USING btree (vehiculo_id, estado);


--
-- Name: idx_audit_recurso; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_recurso ON public.audit_log USING btree (recurso, created_at DESC);


--
-- Name: idx_audit_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_usuario ON public.audit_log USING btree (usuario, created_at DESC);


--
-- Name: idx_consent_ident; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consent_ident ON public.consentimientos USING btree (identificador, created_at DESC);


--
-- Name: idx_dispositivos_vehiculo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dispositivos_vehiculo ON public.dispositivos USING btree (vehiculo_id, activo);


--
-- Name: idx_eventos_viales_creado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eventos_viales_creado ON public.eventos_viales USING btree (creado_en DESC);


--
-- Name: idx_mantenimientos_vehiculo_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mantenimientos_vehiculo_fecha ON public.mantenimientos USING btree (vehiculo_id, fecha DESC);


--
-- Name: idx_mov_inv_repuesto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mov_inv_repuesto ON public.movimientos_inventario USING btree (repuesto_id, created_at DESC);


--
-- Name: idx_notif_log_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notif_log_estado ON public.notificacion_log USING btree (estado, created_at DESC);


--
-- Name: idx_notif_log_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notif_log_fecha ON public.notificacion_log USING btree (created_at DESC);


--
-- Name: idx_opiniones_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_opiniones_estado ON public.opiniones USING btree (estado, creado_en DESC);


--
-- Name: idx_orden_repuestos_orden; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orden_repuestos_orden ON public.orden_repuestos USING btree (orden_id);


--
-- Name: idx_ot_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ot_estado ON public.ordenes_trabajo USING btree (estado, fecha_apertura DESC);


--
-- Name: idx_ot_vehiculo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ot_vehiculo ON public.ordenes_trabajo USING btree (vehiculo_id, fecha_apertura DESC);


--
-- Name: idx_repuestos_bajo_stock; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_repuestos_bajo_stock ON public.repuestos USING btree (activo, stock_actual, stock_minimo);


--
-- Name: idx_repuestos_nombre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_repuestos_nombre ON public.repuestos USING btree (nombre);


--
-- Name: idx_resumen_hora; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resumen_hora ON public.telemetria_resumen USING btree (hora);


--
-- Name: idx_solicitudes_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_solicitudes_estado ON public.solicitudes_datos USING btree (estado, created_at DESC);


--
-- Name: idx_telemetria_manual_vehiculo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_telemetria_manual_vehiculo ON public.telemetria_manual USING btree (vehiculo_id, fecha_registro DESC);


--
-- Name: idx_telemetria_vehiculo_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_telemetria_vehiculo_fecha ON public.telemetria_lectura USING btree (vehiculo_id, fecha_registro DESC);


--
-- Name: idx_usuarios_rol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usuarios_rol ON public.usuarios USING btree (rol_id);


--
-- Name: idx_usuarios_sede; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usuarios_sede ON public.usuarios USING btree (sede);


--
-- Name: idx_vehiculos_codigo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_vehiculos_codigo ON public.vehiculos USING btree (codigo_vinculo);


--
-- Name: idx_vehiculos_vin; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_vehiculos_vin ON public.vehiculos USING btree (vin) WHERE (vin IS NOT NULL);


--
-- Name: idx_webhook_entregas_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_entregas_estado ON public.webhook_entregas USING btree (estado, created_at DESC);


--
-- Name: alerta_mantenimiento alerta_mantenimiento_vehiculo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerta_mantenimiento
    ADD CONSTRAINT alerta_mantenimiento_vehiculo_id_fkey FOREIGN KEY (vehiculo_id) REFERENCES public.vehiculos(id);


--
-- Name: dispositivos dispositivos_vehiculo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispositivos
    ADD CONSTRAINT dispositivos_vehiculo_id_fkey FOREIGN KEY (vehiculo_id) REFERENCES public.vehiculos(id) ON DELETE CASCADE;


--
-- Name: eventos_viales eventos_viales_vehiculo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos_viales
    ADD CONSTRAINT eventos_viales_vehiculo_id_fkey FOREIGN KEY (vehiculo_id) REFERENCES public.vehiculos(id) ON DELETE SET NULL;


--
-- Name: mantenimientos mantenimientos_vehiculo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mantenimientos
    ADD CONSTRAINT mantenimientos_vehiculo_id_fkey FOREIGN KEY (vehiculo_id) REFERENCES public.vehiculos(id) ON DELETE CASCADE;


--
-- Name: movimientos_inventario movimientos_inventario_repuesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_inventario
    ADD CONSTRAINT movimientos_inventario_repuesto_id_fkey FOREIGN KEY (repuesto_id) REFERENCES public.repuestos(id) ON DELETE CASCADE;


--
-- Name: notificacion_log notificacion_log_vehiculo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificacion_log
    ADD CONSTRAINT notificacion_log_vehiculo_id_fkey FOREIGN KEY (vehiculo_id) REFERENCES public.vehiculos(id) ON DELETE SET NULL;


--
-- Name: orden_repuestos orden_repuestos_orden_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orden_repuestos
    ADD CONSTRAINT orden_repuestos_orden_id_fkey FOREIGN KEY (orden_id) REFERENCES public.ordenes_trabajo(id) ON DELETE CASCADE;


--
-- Name: orden_repuestos orden_repuestos_repuesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orden_repuestos
    ADD CONSTRAINT orden_repuestos_repuesto_id_fkey FOREIGN KEY (repuesto_id) REFERENCES public.repuestos(id) ON DELETE SET NULL;


--
-- Name: ordenes_trabajo ordenes_trabajo_mantenimiento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_trabajo
    ADD CONSTRAINT ordenes_trabajo_mantenimiento_id_fkey FOREIGN KEY (mantenimiento_id) REFERENCES public.mantenimientos(id) ON DELETE SET NULL;


--
-- Name: ordenes_trabajo ordenes_trabajo_vehiculo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_trabajo
    ADD CONSTRAINT ordenes_trabajo_vehiculo_id_fkey FOREIGN KEY (vehiculo_id) REFERENCES public.vehiculos(id) ON DELETE CASCADE;


--
-- Name: rol_permiso rol_permiso_permiso_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rol_permiso
    ADD CONSTRAINT rol_permiso_permiso_id_fkey FOREIGN KEY (permiso_id) REFERENCES public.permisos(id) ON DELETE CASCADE;


--
-- Name: rol_permiso rol_permiso_rol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rol_permiso
    ADD CONSTRAINT rol_permiso_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: telemetria_lectura telemetria_lectura_vehiculo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telemetria_lectura
    ADD CONSTRAINT telemetria_lectura_vehiculo_id_fkey FOREIGN KEY (vehiculo_id) REFERENCES public.vehiculos(id);


--
-- Name: telemetria_manual telemetria_manual_vehiculo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telemetria_manual
    ADD CONSTRAINT telemetria_manual_vehiculo_id_fkey FOREIGN KEY (vehiculo_id) REFERENCES public.vehiculos(id) ON DELETE CASCADE;


--
-- Name: telemetria_resumen telemetria_resumen_vehiculo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telemetria_resumen
    ADD CONSTRAINT telemetria_resumen_vehiculo_id_fkey FOREIGN KEY (vehiculo_id) REFERENCES public.vehiculos(id) ON DELETE CASCADE;


--
-- Name: usuarios usuarios_rol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES public.roles(id) ON DELETE SET NULL;


--
-- Name: webhook_entregas webhook_entregas_webhook_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_entregas
    ADD CONSTRAINT webhook_entregas_webhook_id_fkey FOREIGN KEY (webhook_id) REFERENCES public.webhooks(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


