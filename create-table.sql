BEGIN;


CREATE TABLE IF NOT EXISTS public.authorization_codes
(
    id serial NOT NULL,
    code character varying(255) COLLATE pg_catalog."default" NOT NULL,
    client_id character varying(255) COLLATE pg_catalog."default" NOT NULL,
    user_id integer NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    scope text[] COLLATE pg_catalog."default",
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT authorization_codes_pkey PRIMARY KEY (id),
    CONSTRAINT authorization_codes_code_key UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS public.oauth_clients
(
    id serial NOT NULL,
    client_id character varying(255) COLLATE pg_catalog."default" NOT NULL,
    client_secret character varying(255) COLLATE pg_catalog."default" NOT NULL,
    name character varying(255) COLLATE pg_catalog."default" NOT NULL,
    website_url text COLLATE pg_catalog."default",
    user_id integer,
    redirect_uri text COLLATE pg_catalog."default",
    allowed_scopes text[] COLLATE pg_catalog."default",
    CONSTRAINT oauth_clients_pkey PRIMARY KEY (id),
    CONSTRAINT oauth_clients_client_id_key UNIQUE (client_id)
);

CREATE TABLE IF NOT EXISTS public.ttt_chat_messages
(
    id serial NOT NULL,
    user_id integer,
    game_id integer,
    message text COLLATE pg_catalog."default",
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ttt_chat_messages_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.ttt_games
(
    id serial NOT NULL,
    host_id integer,
    guest_id integer,
    board_size integer,
    status character varying(20) COLLATE pg_catalog."default",
    winner_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    turn_time_limit integer DEFAULT 30,
    last_move_time timestamp without time zone,
    current_turn integer,
    allow_custom_settings boolean DEFAULT true,
    CONSTRAINT ttt_games_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.ttt_moves
(
    id serial NOT NULL,
    game_id integer,
    user_id integer,
    position_x integer,
    position_y integer,
    move_number integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ttt_moves_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.ttt_sessions
(
    sid character varying COLLATE pg_catalog."default" NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL,
    CONSTRAINT session_pkey PRIMARY KEY (sid)
);

CREATE TABLE IF NOT EXISTS public.ttt_spectators
(
    id serial NOT NULL,
    game_id integer,
    user_id integer,
    joined_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ttt_spectators_pkey PRIMARY KEY (id),
    CONSTRAINT ttt_spectators_game_id_user_id_key UNIQUE (game_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.ttt_users
(
    id serial NOT NULL,
    oauth_id character varying(255) COLLATE pg_catalog."default" NOT NULL,
    username character varying(100) COLLATE pg_catalog."default" NOT NULL,
    game_piece character varying(50) COLLATE pg_catalog."default" DEFAULT 'X'::character varying,
    board_color character varying(50) COLLATE pg_catalog."default" DEFAULT '#ffffff'::character varying,
    rating integer DEFAULT 1200,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    nickname character varying COLLATE pg_catalog."default",
    avatar bytea,
    avatar_url character varying COLLATE pg_catalog."default",
    CONSTRAINT ttt_users_pkey PRIMARY KEY (id),
    CONSTRAINT ttt_users_oauth_id_key UNIQUE (oauth_id)
);

CREATE TABLE IF NOT EXISTS public.user_sessions
(
    sid character varying COLLATE pg_catalog."default" NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL,
    CONSTRAINT session_pkey2 PRIMARY KEY (sid)
);

CREATE TABLE IF NOT EXISTS public.users
(
    id serial NOT NULL,
    username character varying(255) COLLATE pg_catalog."default" NOT NULL,
    password_hash character varying(255) COLLATE pg_catalog."default" NOT NULL,
    nickname character varying(100) COLLATE pg_catalog."default",
    fullname character varying(255) COLLATE pg_catalog."default",
    avatar bytea,
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_email_key UNIQUE (username)
);

ALTER TABLE IF EXISTS public.authorization_codes
    ADD CONSTRAINT authorization_codes_client_id_fkey FOREIGN KEY (client_id)
    REFERENCES public.oauth_clients (client_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


ALTER TABLE IF EXISTS public.authorization_codes
    ADD CONSTRAINT authorization_codes_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


ALTER TABLE IF EXISTS public.oauth_clients
    ADD CONSTRAINT fk_oauth_clients_user FOREIGN KEY (user_id)
    REFERENCES public.users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;


ALTER TABLE IF EXISTS public.ttt_chat_messages
    ADD CONSTRAINT ttt_chat_messages_game_id_fkey FOREIGN KEY (game_id)
    REFERENCES public.ttt_games (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;


ALTER TABLE IF EXISTS public.ttt_chat_messages
    ADD CONSTRAINT ttt_chat_messages_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.ttt_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


ALTER TABLE IF EXISTS public.ttt_games
    ADD CONSTRAINT ttt_games_current_turn_fkey FOREIGN KEY (current_turn)
    REFERENCES public.ttt_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


ALTER TABLE IF EXISTS public.ttt_games
    ADD CONSTRAINT ttt_games_guest_id_fkey FOREIGN KEY (guest_id)
    REFERENCES public.ttt_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


ALTER TABLE IF EXISTS public.ttt_games
    ADD CONSTRAINT ttt_games_host_id_fkey FOREIGN KEY (host_id)
    REFERENCES public.ttt_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


ALTER TABLE IF EXISTS public.ttt_games
    ADD CONSTRAINT ttt_games_winner_id_fkey FOREIGN KEY (winner_id)
    REFERENCES public.ttt_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


ALTER TABLE IF EXISTS public.ttt_moves
    ADD CONSTRAINT ttt_moves_game_id_fkey FOREIGN KEY (game_id)
    REFERENCES public.ttt_games (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;


ALTER TABLE IF EXISTS public.ttt_moves
    ADD CONSTRAINT ttt_moves_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.ttt_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


ALTER TABLE IF EXISTS public.ttt_spectators
    ADD CONSTRAINT ttt_spectators_game_id_fkey FOREIGN KEY (game_id)
    REFERENCES public.ttt_games (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


ALTER TABLE IF EXISTS public.ttt_spectators
    ADD CONSTRAINT ttt_spectators_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.ttt_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

END;