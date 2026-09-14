--
-- PostgreSQL database dump
--

\restrict pgLy3rqBnlLCiHnec9xlg4VdbbqkM382E4x3trEs6lSPnTWc5qhFKwcJHERM044

-- Dumped from database version 14.21 (Homebrew)
-- Dumped by pg_dump version 14.21 (Homebrew)

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
-- Name: BookingStatus; Type: TYPE; Schema: public; Owner: pallavi
--

CREATE TYPE public."BookingStatus" AS ENUM (
    'PENDING_PAYMENT',
    'AWAITING_PAYMENT',
    'CONFIRMED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'EXPIRED',
    'NO_SHOW'
);


ALTER TYPE public."BookingStatus" OWNER TO pallavi;

--
-- Name: EscrowStatus; Type: TYPE; Schema: public; Owner: pallavi
--

CREATE TYPE public."EscrowStatus" AS ENUM (
    'LOCKED',
    'RELEASED',
    'REFUNDED'
);


ALTER TYPE public."EscrowStatus" OWNER TO pallavi;

--
-- Name: OnboardingStatus; Type: TYPE; Schema: public; Owner: pallavi
--

CREATE TYPE public."OnboardingStatus" AS ENUM (
    'PENDING_KYC',
    'PENDING_APPROVAL',
    'APPROVED',
    'REJECTED'
);


ALTER TYPE public."OnboardingStatus" OWNER TO pallavi;

--
-- Name: PayoutStatus; Type: TYPE; Schema: public; Owner: pallavi
--

CREATE TYPE public."PayoutStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'PAID',
    'FAILED',
    'CANCELLED'
);


ALTER TYPE public."PayoutStatus" OWNER TO pallavi;

--
-- Name: UserRole; Type: TYPE; Schema: public; Owner: pallavi
--

CREATE TYPE public."UserRole" AS ENUM (
    'HELPER',
    'ADMIN',
    'CUSTOMER'
);


ALTER TYPE public."UserRole" OWNER TO pallavi;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: AuthAudit; Type: TABLE; Schema: public; Owner: pallavi
--

CREATE TABLE public."AuthAudit" (
    id integer NOT NULL,
    "userId" integer,
    phone text NOT NULL,
    event text NOT NULL,
    ip text,
    "userAgent" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."AuthAudit" OWNER TO pallavi;

--
-- Name: AuthAudit_id_seq; Type: SEQUENCE; Schema: public; Owner: pallavi
--

CREATE SEQUENCE public."AuthAudit_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."AuthAudit_id_seq" OWNER TO pallavi;

--
-- Name: AuthAudit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pallavi
--

ALTER SEQUENCE public."AuthAudit_id_seq" OWNED BY public."AuthAudit".id;


--
-- Name: Booking; Type: TABLE; Schema: public; Owner: pallavi
--

CREATE TABLE public."Booking" (
    id integer NOT NULL,
    "customerId" integer NOT NULL,
    "serviceId" integer NOT NULL,
    "servicePlanId" integer NOT NULL,
    "helperId" integer,
    "reservedHelperId" integer,
    "reservedAt" timestamp(3) without time zone,
    "bookingDate" timestamp(3) without time zone NOT NULL,
    "startTime" timestamp(3) without time zone,
    "endTime" timestamp(3) without time zone,
    duration integer NOT NULL,
    "totalHours" integer,
    "paymentExpiresAt" timestamp(3) without time zone,
    status public."BookingStatus" DEFAULT 'PENDING_PAYMENT'::public."BookingStatus" NOT NULL,
    location text NOT NULL,
    address text,
    city text,
    "pinCode" text,
    latitude double precision,
    longitude double precision,
    notes text,
    "specialRequirements" text,
    "startOtp" text,
    "startedAt" timestamp(3) without time zone,
    "endedAt" timestamp(3) without time zone,
    "cancelReason" text,
    "totalAmount" double precision NOT NULL,
    "platformFee" double precision DEFAULT 0 NOT NULL,
    tax double precision DEFAULT 0 NOT NULL,
    "finalAmount" double precision NOT NULL,
    "payoutStatus" public."PayoutStatus" DEFAULT 'PENDING'::public."PayoutStatus" NOT NULL,
    "bookingRequestId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "cancelledBy" text,
    "completedAt" timestamp(3) without time zone,
    "payoutAt" timestamp(3) without time zone,
    "payoutEligibleAt" timestamp(3) without time zone,
    "payoutId" text,
    "commissionRateSnapshot" double precision,
    "helperPayoutAmount" double precision,
    "platformCommissionAmount" double precision,
    "refundAmount" double precision,
    "refundedAt" timestamp(3) without time zone
);


ALTER TABLE public."Booking" OWNER TO pallavi;

--
-- Name: BookingRequest; Type: TABLE; Schema: public; Owner: pallavi
--

CREATE TABLE public."BookingRequest" (
    id integer NOT NULL,
    "customerId" integer NOT NULL,
    "bookingId" integer NOT NULL,
    "helperId" integer,
    "serviceId" integer NOT NULL,
    "serviceCategory" text NOT NULL,
    address text NOT NULL,
    city text NOT NULL,
    "pinCode" text NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    "requestedDate" timestamp(3) without time zone NOT NULL,
    "requestedTime" text,
    "estimatedHours" integer NOT NULL,
    "estimatedBudget" double precision,
    description text,
    "specialRequirements" text,
    notes text,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "dispatchedHelperIds" integer[] DEFAULT ARRAY[]::integer[],
    "expiresAt" timestamp(3) without time zone,
    "respondedAt" timestamp(3) without time zone,
    "rejectionReason" text,
    "rejectedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."BookingRequest" OWNER TO pallavi;

--
-- Name: BookingRequest_id_seq; Type: SEQUENCE; Schema: public; Owner: pallavi
--

CREATE SEQUENCE public."BookingRequest_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."BookingRequest_id_seq" OWNER TO pallavi;

--
-- Name: BookingRequest_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pallavi
--

ALTER SEQUENCE public."BookingRequest_id_seq" OWNED BY public."BookingRequest".id;


--
-- Name: Booking_id_seq; Type: SEQUENCE; Schema: public; Owner: pallavi
--

CREATE SEQUENCE public."Booking_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."Booking_id_seq" OWNER TO pallavi;

--
-- Name: Booking_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pallavi
--

ALTER SEQUENCE public."Booking_id_seq" OWNED BY public."Booking".id;


--
-- Name: Helper; Type: TABLE; Schema: public; Owner: pallavi
--

CREATE TABLE public."Helper" (
    id integer NOT NULL,
    rating double precision DEFAULT 0 NOT NULL,
    "totalRatings" integer DEFAULT 0 NOT NULL,
    "isAvailable" boolean DEFAULT false NOT NULL,
    "isOnline" boolean DEFAULT false NOT NULL,
    "lastActiveAt" timestamp(3) without time zone,
    "ignoreCount" integer DEFAULT 0 NOT NULL,
    "noShowCount" integer DEFAULT 0 NOT NULL,
    "cancelCount" integer DEFAULT 0 NOT NULL,
    "penaltyCount" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "onboardingStatus" public."OnboardingStatus" DEFAULT 'PENDING_KYC'::public."OnboardingStatus" NOT NULL,
    "userId" integer NOT NULL,
    "lastStrikeAt" timestamp(3) without time zone,
    "strikeCount" integer DEFAULT 0 NOT NULL
);


ALTER TABLE public."Helper" OWNER TO pallavi;

--
-- Name: HelperAvailability; Type: TABLE; Schema: public; Owner: pallavi
--

CREATE TABLE public."HelperAvailability" (
    id integer NOT NULL,
    "helperId" integer NOT NULL,
    monday boolean DEFAULT false NOT NULL,
    tuesday boolean DEFAULT false NOT NULL,
    wednesday boolean DEFAULT false NOT NULL,
    thursday boolean DEFAULT false NOT NULL,
    friday boolean DEFAULT false NOT NULL,
    saturday boolean DEFAULT false NOT NULL,
    sunday boolean DEFAULT false NOT NULL,
    "startTime" text,
    "endTime" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."HelperAvailability" OWNER TO pallavi;

--
-- Name: HelperAvailability_id_seq; Type: SEQUENCE; Schema: public; Owner: pallavi
--

CREATE SEQUENCE public."HelperAvailability_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."HelperAvailability_id_seq" OWNER TO pallavi;

--
-- Name: HelperAvailability_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pallavi
--

ALTER SEQUENCE public."HelperAvailability_id_seq" OWNED BY public."HelperAvailability".id;


--
-- Name: HelperBank; Type: TABLE; Schema: public; Owner: pallavi
--

CREATE TABLE public."HelperBank" (
    id integer NOT NULL,
    "helperId" integer NOT NULL,
    "accountName" text NOT NULL,
    "accountNumber" text NOT NULL,
    ifsc text NOT NULL,
    "isVerified" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."HelperBank" OWNER TO pallavi;

--
-- Name: HelperBank_id_seq; Type: SEQUENCE; Schema: public; Owner: pallavi
--

CREATE SEQUENCE public."HelperBank_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."HelperBank_id_seq" OWNER TO pallavi;

--
-- Name: HelperBank_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pallavi
--

ALTER SEQUENCE public."HelperBank_id_seq" OWNED BY public."HelperBank".id;


--
-- Name: HelperKyc; Type: TABLE; Schema: public; Owner: pallavi
--

CREATE TABLE public."HelperKyc" (
    id integer NOT NULL,
    "helperId" integer NOT NULL,
    "selfieUrl" text,
    "panUrl" text,
    "policeUrl" text,
    "panNumber" text,
    "isVerified" boolean DEFAULT false NOT NULL,
    "verifiedAt" timestamp(3) without time zone,
    "rejectionReason" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "idfyRawResponse" jsonb,
    "idfyRequestId" text,
    "nameMatchScore" double precision,
    "panNameFromApi" text,
    "verificationStatus" text
);


ALTER TABLE public."HelperKyc" OWNER TO pallavi;

--
-- Name: HelperKyc_id_seq; Type: SEQUENCE; Schema: public; Owner: pallavi
--

CREATE SEQUENCE public."HelperKyc_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."HelperKyc_id_seq" OWNER TO pallavi;

--
-- Name: HelperKyc_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pallavi
--

ALTER SEQUENCE public."HelperKyc_id_seq" OWNED BY public."HelperKyc".id;


--
-- Name: HelperProfile; Type: TABLE; Schema: public; Owner: pallavi
--

CREATE TABLE public."HelperProfile" (
    id integer NOT NULL,
    "helperId" integer NOT NULL,
    gender text,
    address text,
    city text,
    "pinCode" text,
    latitude double precision,
    longitude double precision,
    "workType" text,
    "experienceYears" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."HelperProfile" OWNER TO pallavi;

--
-- Name: HelperProfile_id_seq; Type: SEQUENCE; Schema: public; Owner: pallavi
--

CREATE SEQUENCE public."HelperProfile_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."HelperProfile_id_seq" OWNER TO pallavi;

--
-- Name: HelperProfile_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pallavi
--

ALTER SEQUENCE public."HelperProfile_id_seq" OWNED BY public."HelperProfile".id;


--
-- Name: HelperService; Type: TABLE; Schema: public; Owner: pallavi
--

CREATE TABLE public."HelperService" (
    id integer NOT NULL,
    "helperId" integer NOT NULL,
    "serviceId" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."HelperService" OWNER TO pallavi;

--
-- Name: HelperService_id_seq; Type: SEQUENCE; Schema: public; Owner: pallavi
--

CREATE SEQUENCE public."HelperService_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."HelperService_id_seq" OWNER TO pallavi;

--
-- Name: HelperService_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pallavi
--

ALTER SEQUENCE public."HelperService_id_seq" OWNED BY public."HelperService".id;


--
-- Name: Helper_id_seq; Type: SEQUENCE; Schema: public; Owner: pallavi
--

CREATE SEQUENCE public."Helper_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."Helper_id_seq" OWNER TO pallavi;

--
-- Name: Helper_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pallavi
--

ALTER SEQUENCE public."Helper_id_seq" OWNED BY public."Helper".id;


--
-- Name: Otp; Type: TABLE; Schema: public; Owner: pallavi
--

CREATE TABLE public."Otp" (
    id integer NOT NULL,
    phone text NOT NULL,
    purpose text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Otp" OWNER TO pallavi;

--
-- Name: OtpSecurity; Type: TABLE; Schema: public; Owner: pallavi
--

CREATE TABLE public."OtpSecurity" (
    id integer NOT NULL,
    phone text NOT NULL,
    "failedAttempts" integer DEFAULT 0 NOT NULL,
    "lockedUntil" timestamp(3) without time zone,
    "lastSentAt" timestamp(3) without time zone,
    "resendCount" integer DEFAULT 0 NOT NULL,
    "resendResetAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."OtpSecurity" OWNER TO pallavi;

--
-- Name: OtpSecurity_id_seq; Type: SEQUENCE; Schema: public; Owner: pallavi
--

CREATE SEQUENCE public."OtpSecurity_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."OtpSecurity_id_seq" OWNER TO pallavi;

--
-- Name: OtpSecurity_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pallavi
--

ALTER SEQUENCE public."OtpSecurity_id_seq" OWNED BY public."OtpSecurity".id;


--
-- Name: Otp_id_seq; Type: SEQUENCE; Schema: public; Owner: pallavi
--

CREATE SEQUENCE public."Otp_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."Otp_id_seq" OWNER TO pallavi;

--
-- Name: Otp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pallavi
--

ALTER SEQUENCE public."Otp_id_seq" OWNED BY public."Otp".id;


--
-- Name: Payment; Type: TABLE; Schema: public; Owner: pallavi
--

CREATE TABLE public."Payment" (
    id integer NOT NULL,
    "bookingId" integer NOT NULL,
    amount double precision NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "transactionId" text,
    "razorpayOrderId" text,
    "razorpayPaymentId" text,
    "escrowStatus" public."EscrowStatus" DEFAULT 'LOCKED'::public."EscrowStatus",
    "refundReason" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Payment" OWNER TO pallavi;

--
-- Name: Payment_id_seq; Type: SEQUENCE; Schema: public; Owner: pallavi
--

CREATE SEQUENCE public."Payment_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."Payment_id_seq" OWNER TO pallavi;

--
-- Name: Payment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pallavi
--

ALTER SEQUENCE public."Payment_id_seq" OWNED BY public."Payment".id;


--
-- Name: PlatformSetting; Type: TABLE; Schema: public; Owner: pallavi
--

CREATE TABLE public."PlatformSetting" (
    id integer DEFAULT 1 NOT NULL,
    "commissionRate" double precision DEFAULT 0.20 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."PlatformSetting" OWNER TO pallavi;

--
-- Name: Rating; Type: TABLE; Schema: public; Owner: pallavi
--

CREATE TABLE public."Rating" (
    id integer NOT NULL,
    "bookingId" integer NOT NULL,
    "userId" integer NOT NULL,
    "helperId" integer NOT NULL,
    rating integer NOT NULL,
    review text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Rating" OWNER TO pallavi;

--
-- Name: Rating_id_seq; Type: SEQUENCE; Schema: public; Owner: pallavi
--

CREATE SEQUENCE public."Rating_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."Rating_id_seq" OWNER TO pallavi;

--
-- Name: Rating_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pallavi
--

ALTER SEQUENCE public."Rating_id_seq" OWNED BY public."Rating".id;


--
-- Name: RefreshToken; Type: TABLE; Schema: public; Owner: pallavi
--

CREATE TABLE public."RefreshToken" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    "tokenHash" text NOT NULL,
    revoked boolean DEFAULT false NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deviceId" text,
    "ipAddress" text,
    "userAgent" text
);


ALTER TABLE public."RefreshToken" OWNER TO pallavi;

--
-- Name: RefreshToken_id_seq; Type: SEQUENCE; Schema: public; Owner: pallavi
--

CREATE SEQUENCE public."RefreshToken_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."RefreshToken_id_seq" OWNER TO pallavi;

--
-- Name: RefreshToken_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pallavi
--

ALTER SEQUENCE public."RefreshToken_id_seq" OWNED BY public."RefreshToken".id;


--
-- Name: Service; Type: TABLE; Schema: public; Owner: pallavi
--

CREATE TABLE public."Service" (
    id integer NOT NULL,
    name text NOT NULL,
    title text,
    category text NOT NULL,
    description text,
    "hourlyRate" double precision,
    "minimumHours" integer DEFAULT 1 NOT NULL,
    "maximumHours" integer,
    "isAvailable" boolean DEFAULT true NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Service" OWNER TO pallavi;

--
-- Name: ServicePlan; Type: TABLE; Schema: public; Owner: pallavi
--

CREATE TABLE public."ServicePlan" (
    id integer NOT NULL,
    "serviceId" integer NOT NULL,
    "planType" text NOT NULL,
    duration integer NOT NULL,
    price double precision NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL
);


ALTER TABLE public."ServicePlan" OWNER TO pallavi;

--
-- Name: ServicePlan_id_seq; Type: SEQUENCE; Schema: public; Owner: pallavi
--

CREATE SEQUENCE public."ServicePlan_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."ServicePlan_id_seq" OWNER TO pallavi;

--
-- Name: ServicePlan_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pallavi
--

ALTER SEQUENCE public."ServicePlan_id_seq" OWNED BY public."ServicePlan".id;


--
-- Name: Service_id_seq; Type: SEQUENCE; Schema: public; Owner: pallavi
--

CREATE SEQUENCE public."Service_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."Service_id_seq" OWNER TO pallavi;

--
-- Name: Service_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pallavi
--

ALTER SEQUENCE public."Service_id_seq" OWNED BY public."Service".id;


--
-- Name: User; Type: TABLE; Schema: public; Owner: pallavi
--

CREATE TABLE public."User" (
    id integer NOT NULL,
    phone text NOT NULL,
    "fullName" text NOT NULL,
    avatar text,
    "isActive" boolean DEFAULT false NOT NULL,
    "isBlocked" boolean DEFAULT false NOT NULL,
    "suspendedUntil" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    role public."UserRole" DEFAULT 'CUSTOMER'::public."UserRole" NOT NULL
);


ALTER TABLE public."User" OWNER TO pallavi;

--
-- Name: User_id_seq; Type: SEQUENCE; Schema: public; Owner: pallavi
--

CREATE SEQUENCE public."User_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."User_id_seq" OWNER TO pallavi;

--
-- Name: User_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pallavi
--

ALTER SEQUENCE public."User_id_seq" OWNED BY public."User".id;


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: pallavi
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO pallavi;

--
-- Name: pan_verification; Type: TABLE; Schema: public; Owner: pallavi
--

CREATE TABLE public.pan_verification (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    "panNumber" text NOT NULL,
    "panName" text NOT NULL,
    "isVerified" boolean DEFAULT false NOT NULL,
    "verificationId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.pan_verification OWNER TO pallavi;

--
-- Name: pan_verification_id_seq; Type: SEQUENCE; Schema: public; Owner: pallavi
--

CREATE SEQUENCE public.pan_verification_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.pan_verification_id_seq OWNER TO pallavi;

--
-- Name: pan_verification_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pallavi
--

ALTER SEQUENCE public.pan_verification_id_seq OWNED BY public.pan_verification.id;


--
-- Name: AuthAudit id; Type: DEFAULT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."AuthAudit" ALTER COLUMN id SET DEFAULT nextval('public."AuthAudit_id_seq"'::regclass);


--
-- Name: Booking id; Type: DEFAULT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."Booking" ALTER COLUMN id SET DEFAULT nextval('public."Booking_id_seq"'::regclass);


--
-- Name: BookingRequest id; Type: DEFAULT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."BookingRequest" ALTER COLUMN id SET DEFAULT nextval('public."BookingRequest_id_seq"'::regclass);


--
-- Name: Helper id; Type: DEFAULT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."Helper" ALTER COLUMN id SET DEFAULT nextval('public."Helper_id_seq"'::regclass);


--
-- Name: HelperAvailability id; Type: DEFAULT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."HelperAvailability" ALTER COLUMN id SET DEFAULT nextval('public."HelperAvailability_id_seq"'::regclass);


--
-- Name: HelperBank id; Type: DEFAULT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."HelperBank" ALTER COLUMN id SET DEFAULT nextval('public."HelperBank_id_seq"'::regclass);


--
-- Name: HelperKyc id; Type: DEFAULT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."HelperKyc" ALTER COLUMN id SET DEFAULT nextval('public."HelperKyc_id_seq"'::regclass);


--
-- Name: HelperProfile id; Type: DEFAULT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."HelperProfile" ALTER COLUMN id SET DEFAULT nextval('public."HelperProfile_id_seq"'::regclass);


--
-- Name: HelperService id; Type: DEFAULT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."HelperService" ALTER COLUMN id SET DEFAULT nextval('public."HelperService_id_seq"'::regclass);


--
-- Name: Otp id; Type: DEFAULT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."Otp" ALTER COLUMN id SET DEFAULT nextval('public."Otp_id_seq"'::regclass);


--
-- Name: OtpSecurity id; Type: DEFAULT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."OtpSecurity" ALTER COLUMN id SET DEFAULT nextval('public."OtpSecurity_id_seq"'::regclass);


--
-- Name: Payment id; Type: DEFAULT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."Payment" ALTER COLUMN id SET DEFAULT nextval('public."Payment_id_seq"'::regclass);


--
-- Name: Rating id; Type: DEFAULT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."Rating" ALTER COLUMN id SET DEFAULT nextval('public."Rating_id_seq"'::regclass);


--
-- Name: RefreshToken id; Type: DEFAULT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."RefreshToken" ALTER COLUMN id SET DEFAULT nextval('public."RefreshToken_id_seq"'::regclass);


--
-- Name: Service id; Type: DEFAULT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."Service" ALTER COLUMN id SET DEFAULT nextval('public."Service_id_seq"'::regclass);


--
-- Name: ServicePlan id; Type: DEFAULT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."ServicePlan" ALTER COLUMN id SET DEFAULT nextval('public."ServicePlan_id_seq"'::regclass);


--
-- Name: User id; Type: DEFAULT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."User" ALTER COLUMN id SET DEFAULT nextval('public."User_id_seq"'::regclass);


--
-- Name: pan_verification id; Type: DEFAULT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public.pan_verification ALTER COLUMN id SET DEFAULT nextval('public.pan_verification_id_seq'::regclass);


--
-- Data for Name: AuthAudit; Type: TABLE DATA; Schema: public; Owner: pallavi
--

COPY public."AuthAudit" (id, "userId", phone, event, ip, "userAgent", "createdAt") FROM stdin;
1	\N	9549471019	OTP_SENT	::1	PostmanRuntime/7.51.1	2026-02-21 17:41:15.77
2	\N	9549471019	OTP_FAILED	::1	PostmanRuntime/7.51.1	2026-02-21 17:41:34.731
3	\N	9549471019	OTP_VERIFIED	::1	PostmanRuntime/7.51.1	2026-02-21 17:41:56.647
4	6	9549471019	LOGIN_SUCCESS	::1	PostmanRuntime/7.51.1	2026-02-21 17:41:56.658
5	\N	7221963914	OTP_SENT	::1	PostmanRuntime/7.51.1	2026-02-21 18:26:49.965
6	\N	9549471019	OTP_VERIFIED	::1	PostmanRuntime/7.51.1	2026-02-21 18:27:10.178
7	7	9549471019	LOGIN_SUCCESS	::1	PostmanRuntime/7.51.1	2026-02-21 18:27:10.19
8	\N	7221963914	OTP_VERIFIED	::1	PostmanRuntime/7.51.1	2026-02-21 18:28:27.026
9	8	7221963914	LOGIN_SUCCESS	::1	PostmanRuntime/7.51.1	2026-02-21 18:28:27.035
10	\N	7221963914	OTP_SENT	::1	PostmanRuntime/7.51.1	2026-02-21 18:37:03.315
11	\N	7221963914	OTP_VERIFIED	::1	PostmanRuntime/7.51.1	2026-02-21 18:37:18.604
12	10	7221963914	LOGIN_SUCCESS	::1	PostmanRuntime/7.51.1	2026-02-21 18:37:18.616
13	\N	7221963914	OTP_VERIFIED	::1	PostmanRuntime/7.51.1	2026-02-21 18:38:47.479
14	10	7221963914	LOGIN_SUCCESS	::1	PostmanRuntime/7.51.1	2026-02-21 18:38:47.492
15	\N	7221963914	OTP_SENT	::1	PostmanRuntime/7.51.1	2026-02-21 18:39:41.646
16	\N	7221963914	OTP_VERIFIED	::1	PostmanRuntime/7.51.1	2026-02-21 18:39:58.14
17	12	7221963914	LOGIN_SUCCESS	::1	PostmanRuntime/7.51.1	2026-02-21 18:39:58.148
18	\N	7221963914	OTP_SENT	::1	PostmanRuntime/7.51.1	2026-02-21 18:41:22.318
19	\N	7221963914	OTP_VERIFIED	::1	PostmanRuntime/7.51.1	2026-02-21 18:41:42.357
20	12	7221963914	LOGIN_SUCCESS	::1	PostmanRuntime/7.51.1	2026-02-21 18:41:42.368
21	\N	7221963914	OTP_SENT	::1	PostmanRuntime/7.51.1	2026-02-22 03:17:34.556
22	\N	7221963914	OTP_VERIFIED	::1	PostmanRuntime/7.51.1	2026-02-22 03:17:57.231
23	12	7221963914	LOGIN_SUCCESS	::1	PostmanRuntime/7.51.1	2026-02-22 03:17:57.247
24	12		KYC_SUBMITTED	::1	PostmanRuntime/7.51.1	2026-02-22 03:19:52.192
25	12		KYC_REVIEW_REQUIRED	::1	PostmanRuntime/7.51.1	2026-02-22 03:19:52.192
26	\N	7221963914	OTP_SENT	::1	PostmanRuntime/7.51.1	2026-02-22 03:30:28.173
27	\N	7221963914	OTP_VERIFIED	::1	PostmanRuntime/7.51.1	2026-02-22 03:30:51.946
28	13	7221963914	LOGIN_SUCCESS	::1	PostmanRuntime/7.51.1	2026-02-22 03:30:51.961
29	\N	7221963914	OTP_SENT	::1	PostmanRuntime/7.51.1	2026-02-22 03:42:19.015
30	\N	7221963914	OTP_VERIFIED	::1	PostmanRuntime/7.51.1	2026-02-22 03:42:34.398
31	13	7221963914	LOGIN_SUCCESS	::1	PostmanRuntime/7.51.1	2026-02-22 03:42:34.412
32	13		KYC_SUBMITTED	::1	PostmanRuntime/7.51.1	2026-02-22 03:48:03.434
33	13		KYC_REVIEW_REQUIRED	::1	PostmanRuntime/7.51.1	2026-02-22 03:48:03.435
34	\N	7221963914	OTP_SENT	::1	PostmanRuntime/7.51.1	2026-02-22 04:16:42.912
35	\N	7221963914	OTP_VERIFIED	::1	PostmanRuntime/7.51.1	2026-02-22 04:17:25.349
36	13	7221963914	LOGIN_SUCCESS	::1	PostmanRuntime/7.51.1	2026-02-22 04:17:25.363
37	\N	7221963914	OTP_SENT	::1	PostmanRuntime/7.51.1	2026-02-22 05:04:45.353
38	\N	7221963914	OTP_VERIFIED	::1	PostmanRuntime/7.51.1	2026-02-22 05:05:11.056
39	13	7221963914	LOGIN_SUCCESS	::1	PostmanRuntime/7.51.1	2026-02-22 05:05:11.071
\.


--
-- Data for Name: Booking; Type: TABLE DATA; Schema: public; Owner: pallavi
--

COPY public."Booking" (id, "customerId", "serviceId", "servicePlanId", "helperId", "reservedHelperId", "reservedAt", "bookingDate", "startTime", "endTime", duration, "totalHours", "paymentExpiresAt", status, location, address, city, "pinCode", latitude, longitude, notes, "specialRequirements", "startOtp", "startedAt", "endedAt", "cancelReason", "totalAmount", "platformFee", tax, "finalAmount", "payoutStatus", "bookingRequestId", "createdAt", "updatedAt", "cancelledBy", "completedAt", "payoutAt", "payoutEligibleAt", "payoutId", "commissionRateSnapshot", "helperPayoutAmount", "platformCommissionAmount", "refundAmount", "refundedAt") FROM stdin;
1	11	1	4	\N	\N	\N	2026-02-25 00:00:00	\N	\N	2	\N	\N	CANCELLED	Jaipur	Vaishali Nagar	\N	\N	\N	\N		\N	\N	\N	\N	Migrated from legacy dispatch status	150	15	8.25	173.25	PENDING	\N	2026-02-22 03:05:08.432	2026-02-22 03:05:08.432	SYSTEM	\N	\N	\N	\N	\N	\N	\N	\N	\N
2	11	1	4	\N	\N	\N	2026-02-25 00:00:00	\N	\N	2	\N	\N	CANCELLED	Jaipur	Vaishali Nagar	\N	\N	\N	\N		\N	\N	\N	\N	Migrated from legacy dispatch status	150	15	8.25	173.25	PENDING	\N	2026-02-22 03:06:27.28	2026-02-22 03:06:27.28	SYSTEM	\N	\N	\N	\N	\N	\N	\N	\N	\N
3	11	1	4	\N	\N	\N	2026-02-25 00:00:00	2026-02-25 10:00:00	\N	2	\N	\N	CANCELLED	Jaipur	Vaishali Nagar	\N	\N	\N	\N		\N	\N	\N	\N	Migrated from legacy dispatch status	150	15	8.25	173.25	PENDING	\N	2026-02-22 03:09:32.609	2026-02-22 03:09:32.609	SYSTEM	\N	\N	\N	\N	\N	\N	\N	\N	\N
4	11	1	4	\N	\N	\N	2026-02-25 00:00:00	2026-02-25 10:00:00	\N	2	\N	\N	CANCELLED	Jaipur	Vaishali Nagar	Jaipur	302021	26.9124	75.7873		\N	\N	\N	\N	Migrated from legacy dispatch status	150	15	8.25	173.25	PENDING	\N	2026-02-22 04:08:27.364	2026-02-22 04:13:07.184	SYSTEM	\N	\N	\N	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: BookingRequest; Type: TABLE DATA; Schema: public; Owner: pallavi
--

COPY public."BookingRequest" (id, "customerId", "bookingId", "helperId", "serviceId", "serviceCategory", address, city, "pinCode", latitude, longitude, "requestedDate", "requestedTime", "estimatedHours", "estimatedBudget", description, "specialRequirements", notes, status, "dispatchedHelperIds", "expiresAt", "respondedAt", "rejectionReason", "rejectedAt", "createdAt", "updatedAt") FROM stdin;
1	11	4	6	1	General	Vaishali Nagar	Jaipur	302021	26.9124	75.7873	2026-02-25 00:00:00	\N	2	\N	\N	\N	\N	expired	{}	\N	\N	\N	\N	2026-02-22 04:13:07.189	2026-02-22 05:23:36.978
\.


--
-- Data for Name: Helper; Type: TABLE DATA; Schema: public; Owner: pallavi
--

COPY public."Helper" (id, rating, "totalRatings", "isAvailable", "isOnline", "lastActiveAt", "ignoreCount", "noShowCount", "cancelCount", "penaltyCount", "createdAt", "updatedAt", "onboardingStatus", "userId", "lastStrikeAt", "strikeCount") FROM stdin;
6	0	0	t	f	2026-02-22 03:55:40.165	0	0	0	0	2026-02-22 03:42:34.404	2026-02-22 05:01:11.702	APPROVED	13	\N	0
\.


--
-- Data for Name: HelperAvailability; Type: TABLE DATA; Schema: public; Owner: pallavi
--

COPY public."HelperAvailability" (id, "helperId", monday, tuesday, wednesday, thursday, friday, saturday, sunday, "startTime", "endTime", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: HelperBank; Type: TABLE DATA; Schema: public; Owner: pallavi
--

COPY public."HelperBank" (id, "helperId", "accountName", "accountNumber", ifsc, "isVerified", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: HelperKyc; Type: TABLE DATA; Schema: public; Owner: pallavi
--

COPY public."HelperKyc" (id, "helperId", "selfieUrl", "panUrl", "policeUrl", "panNumber", "isVerified", "verifiedAt", "rejectionReason", "createdAt", "updatedAt", "idfyRawResponse", "idfyRequestId", "nameMatchScore", "panNameFromApi", "verificationStatus") FROM stdin;
2	6	https://cdn.test.com/selfie.jpg	https://cdn.test.com/pan.jpg	https://cdn.test.com/police.jpg	ABCDE1234F	f	\N	\N	2026-02-22 03:48:03.423	2026-02-22 03:48:03.43	{"error": "IDFY service not configured"}	\N	0	\N	REVIEW
\.


--
-- Data for Name: HelperProfile; Type: TABLE DATA; Schema: public; Owner: pallavi
--

COPY public."HelperProfile" (id, "helperId", gender, address, city, "pinCode", latitude, longitude, "workType", "experienceYears", "createdAt", "updatedAt") FROM stdin;
7	6	MALE	Malviya Nagar	Jaipur	302017	26.8467	75.8056	FULL_TIME	3	2026-02-22 03:42:49.011	2026-02-22 03:45:43.326
\.


--
-- Data for Name: HelperService; Type: TABLE DATA; Schema: public; Owner: pallavi
--

COPY public."HelperService" (id, "helperId", "serviceId", "createdAt") FROM stdin;
15	6	1	2026-02-22 03:45:43.33
16	6	2	2026-02-22 03:45:43.33
\.


--
-- Data for Name: Otp; Type: TABLE DATA; Schema: public; Owner: pallavi
--

COPY public."Otp" (id, phone, purpose, "expiresAt", "createdAt") FROM stdin;
1	7221963914	signup	2026-02-21 16:07:17.304	2026-02-21 16:02:17.305
6	6377289049	login	2026-02-21 17:35:19.7	2026-02-21 17:30:19.701
\.


--
-- Data for Name: OtpSecurity; Type: TABLE DATA; Schema: public; Owner: pallavi
--

COPY public."OtpSecurity" (id, phone, "failedAttempts", "lockedUntil", "lastSentAt", "resendCount", "resendResetAt", "createdAt", "updatedAt") FROM stdin;
1	9549471019	0	\N	2026-02-21 17:41:15.762	1	2026-02-21 17:41:15.762	2026-02-21 17:41:15.763	2026-02-21 18:27:10.175
3	7221963914	0	\N	2026-02-22 05:04:45.346	1	2026-02-22 05:04:45.346	2026-02-21 18:26:49.963	2026-02-22 05:05:11.054
\.


--
-- Data for Name: Payment; Type: TABLE DATA; Schema: public; Owner: pallavi
--

COPY public."Payment" (id, "bookingId", amount, status, "transactionId", "razorpayOrderId", "razorpayPaymentId", "escrowStatus", "refundReason", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: PlatformSetting; Type: TABLE DATA; Schema: public; Owner: pallavi
--

COPY public."PlatformSetting" (id, "commissionRate", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Rating; Type: TABLE DATA; Schema: public; Owner: pallavi
--

COPY public."Rating" (id, "bookingId", "userId", "helperId", rating, review, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: RefreshToken; Type: TABLE DATA; Schema: public; Owner: pallavi
--

COPY public."RefreshToken" (id, "userId", "tokenHash", revoked, "expiresAt", "createdAt", "deviceId", "ipAddress", "userAgent") FROM stdin;
13	11	$2b$10$y.2si5GWAO2G/v63HsrI5eT7ic1S66TGyaJtQOqGIu7rgGMpjlmwe	f	2026-02-28 18:39:35.41	2026-02-21 18:39:35.411	\N	\N	\N
16	11	$2b$10$pRH/YisdoexlEx.wt7dz7emku.8ZY/G8t6Q9ApfyN/EDcuz06Ygk.	f	2026-03-01 02:30:06.781	2026-02-22 02:30:06.782	\N	\N	\N
17	11	$2b$10$M6OM8wwW2gF92lrXNV0HmuG0k2J7qxNTwQEn9NwY3vLJCh4OpDmne	f	2026-03-01 03:04:38.58	2026-02-22 03:04:38.58	\N	\N	\N
19	13	9bfd38aec32b4cf2eca102d53190e8305de5fd80f1cb75294f83d12d324364bb	f	2026-03-01 03:30:51.958	2026-02-22 03:30:51.959	\N	::1	PostmanRuntime/7.51.1
20	13	ac4a5de5a86858ca3c6a84f51db327514daa4caba01bdee00b6a246ffd9dc1c0	f	2026-03-01 03:42:34.408	2026-02-22 03:42:34.409	\N	::1	PostmanRuntime/7.51.1
21	11	$2b$10$5qQcRtz90jJmX1STURwPXOaHjqDSMk0GkBs/.If3ccL9uo/H43KWy	f	2026-03-01 04:06:34.822	2026-02-22 04:06:34.823	\N	\N	\N
22	13	1137dc7a6f68815f135573b21095dd1e8073e66e10936caca022c81f86994c8b	f	2026-03-01 04:17:25.359	2026-02-22 04:17:25.36	\N	::1	PostmanRuntime/7.51.1
23	11	$2b$10$Uhd72K3a8.RDWQDB8orop.5fdMhfwYk2DVHOouqrrDqAMx9Azw9ai	f	2026-03-01 04:21:52.479	2026-02-22 04:21:52.48	\N	\N	\N
24	11	$2b$10$OprC8ci9/EUIO4OXnnejoOhPv2TunHzX5tFe87tHwJDGWZJt2et4G	f	2026-03-01 05:02:10.775	2026-02-22 05:02:10.776	\N	\N	\N
25	13	adc0303034c74925619a723b6c64e2e95cf178d61f0ae51bc0149d903e361ce9	f	2026-03-01 05:05:11.066	2026-02-22 05:05:11.068	\N	::1	PostmanRuntime/7.51.1
\.


--
-- Data for Name: Service; Type: TABLE DATA; Schema: public; Owner: pallavi
--

COPY public."Service" (id, name, title, category, description, "hourlyRate", "minimumHours", "maximumHours", "isAvailable", "isActive", "createdAt", "updatedAt") FROM stdin;
1	Maid	\N	General	\N	\N	1	\N	t	t	2026-02-22 08:14:02.404	2026-02-22 08:14:02.404
2	Cook	\N	General	\N	\N	1	\N	t	t	2026-02-22 08:14:02.404	2026-02-22 08:14:02.404
3	Driver	\N	General	\N	\N	1	\N	t	t	2026-02-22 08:14:02.404	2026-02-22 08:14:02.404
4	Baby Sitter	\N	General	\N	\N	1	\N	t	t	2026-02-22 08:14:02.404	2026-02-22 08:14:02.404
5	Patient Care	\N	General	\N	\N	1	\N	t	t	2026-02-22 08:14:02.404	2026-02-22 08:14:02.404
\.


--
-- Data for Name: ServicePlan; Type: TABLE DATA; Schema: public; Owner: pallavi
--

COPY public."ServicePlan" (id, "serviceId", "planType", duration, price, "isActive") FROM stdin;
4	1	HOURLY	2	150	t
5	1	PER_DAY	8	800	t
6	1	MONTHLY	30	3000	t
7	2	HOURLY	2	300	t
8	2	PER_DAY	8	1200	t
9	2	MONTHLY	26	14000	t
10	3	HOURLY	2	400	t
11	3	PER_DAY	8	1500	t
12	3	MONTHLY	26	18000	t
13	4	HOURLY	2	350	t
14	4	PER_DAY	8	1300	t
15	4	MONTHLY	26	16000	t
16	5	HOURLY	2	500	t
17	5	PER_DAY	8	1800	t
18	5	MONTHLY	26	22000	t
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: pallavi
--

COPY public."User" (id, phone, "fullName", avatar, "isActive", "isBlocked", "suspendedUntil", "createdAt", "updatedAt", role) FROM stdin;
11	9549471019	Manu Khandelwal	\N	t	f	\N	2026-02-21 18:39:35.326	2026-02-21 18:39:35.326	CUSTOMER
13	7221963914		\N	t	f	\N	2026-02-22 03:30:51.95	2026-02-22 03:30:51.95	CUSTOMER
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: pallavi
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
01414919-d539-4986-bac3-19e350049650	e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855	2026-02-21 21:23:21.685942+05:30	20260218_add_request_expires_at	\N	\N	2026-02-21 21:23:21.684618+05:30	1
2bf484bd-e9f8-4070-9e8d-f78899540577	776febffe6d82bcf1337b39e7c54d95b09025eb4fdbbcc80a97febfb8ee161f2	2026-02-21 21:23:21.718536+05:30	20260220073037_add_service_fields	\N	\N	2026-02-21 21:23:21.68654+05:30	1
9d33ca01-1b71-48d4-9e67-27c3fe5809e0	a3f58c500112ef4f6534fc218cadf32dc66ca65bdd9a95d163551c8e840206c0	2026-02-21 21:23:21.719767+05:30	20260220073232_add_booking_lifecycle_fields	\N	\N	2026-02-21 21:23:21.718856+05:30	1
6e68a7aa-5915-47d9-b731-3156b76d7769	74659a89c410be68ea9f8f1ed0558a7057955761e50d3283f780cd75359b71ff	2026-02-21 21:23:21.721459+05:30	20260220094452_helper_user_refactor	\N	\N	2026-02-21 21:23:21.720032+05:30	1
cdc07928-5a31-4602-acea-b93b172a7125	af7d30551a3ecdd45d28ce816636eec3d6eaaf6ddfbdeb544d3fdb618a634c51	2026-02-21 21:23:21.727258+05:30	20260220100636_structural_refactor	\N	\N	2026-02-21 21:23:21.721755+05:30	1
e737149a-92f0-499a-bb9d-75e2f57ac801	0bbaf37e3f59dbae6de206516c3926c21e842a555c6d7ab04a8b2f12664c038e	2026-02-21 21:23:21.730825+05:30	20260220140618_helper_multi_service	\N	\N	2026-02-21 21:23:21.727547+05:30	1
ffe56edf-0166-43ce-9b77-16b6a3fda3b2	4415234dbf7ad6d54d526318c8611be49077b6f7afb5f7f888f014bfa69839e4	2026-02-21 21:23:21.738548+05:30	20260220142859_onboarding_step_models	\N	\N	2026-02-21 21:23:21.731099+05:30	1
2f4df10a-6d6d-4032-99aa-fa9f8f3575f5	d65607db1814528062634117fb4acd784281b7076e03bc38a8a20b87d7c5b891	2026-02-21 21:23:21.739711+05:30	20260220191252_otp_logging_only	\N	\N	2026-02-21 21:23:21.738803+05:30	1
1ffc9805-6a48-46b0-b69c-037892fa69b2	616285a62f71cea4c1eee2a442dac08c68e14337db035910bf13ebb75a4af0c1	2026-02-21 21:23:21.745317+05:30	20260221073946_partner_system_stabilization	\N	\N	2026-02-21 21:23:21.73999+05:30	1
45e4a922-0fa4-491c-8bf0-9ab8d65b98e2	da46658eb104d2702d2c0103b07c3457667b0c4d6c22b8bf8abd35b08b4db6ee	2026-02-21 21:23:21.746141+05:30	20260221154419_add_customer_role	\N	\N	2026-02-21 21:23:21.745568+05:30	1
8fb08917-276c-48a1-9923-b91edf341dfa	d061e71b164c975e98956249fa3b2d256dd92bfc62ac8b3f6459e5139becb7c2	2026-02-21 21:24:23.645823+05:30	20260221155423_set_customer_default	\N	\N	2026-02-21 21:24:23.643609+05:30	1
\.


--
-- Data for Name: pan_verification; Type: TABLE DATA; Schema: public; Owner: pallavi
--

COPY public.pan_verification (id, "userId", "panNumber", "panName", "isVerified", "verificationId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Name: AuthAudit_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pallavi
--

SELECT pg_catalog.setval('public."AuthAudit_id_seq"', 39, true);


--
-- Name: BookingRequest_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pallavi
--

SELECT pg_catalog.setval('public."BookingRequest_id_seq"', 1, true);


--
-- Name: Booking_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pallavi
--

SELECT pg_catalog.setval('public."Booking_id_seq"', 4, true);


--
-- Name: HelperAvailability_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pallavi
--

SELECT pg_catalog.setval('public."HelperAvailability_id_seq"', 1, false);


--
-- Name: HelperBank_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pallavi
--

SELECT pg_catalog.setval('public."HelperBank_id_seq"', 1, false);


--
-- Name: HelperKyc_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pallavi
--

SELECT pg_catalog.setval('public."HelperKyc_id_seq"', 2, true);


--
-- Name: HelperProfile_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pallavi
--

SELECT pg_catalog.setval('public."HelperProfile_id_seq"', 8, true);


--
-- Name: HelperService_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pallavi
--

SELECT pg_catalog.setval('public."HelperService_id_seq"', 16, true);


--
-- Name: Helper_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pallavi
--

SELECT pg_catalog.setval('public."Helper_id_seq"', 7, true);


--
-- Name: OtpSecurity_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pallavi
--

SELECT pg_catalog.setval('public."OtpSecurity_id_seq"', 22, true);


--
-- Name: Otp_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pallavi
--

SELECT pg_catalog.setval('public."Otp_id_seq"', 15, true);


--
-- Name: Payment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pallavi
--

SELECT pg_catalog.setval('public."Payment_id_seq"', 1, false);


--
-- Name: Rating_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pallavi
--

SELECT pg_catalog.setval('public."Rating_id_seq"', 1, false);


--
-- Name: RefreshToken_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pallavi
--

SELECT pg_catalog.setval('public."RefreshToken_id_seq"', 25, true);


--
-- Name: ServicePlan_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pallavi
--

SELECT pg_catalog.setval('public."ServicePlan_id_seq"', 18, true);


--
-- Name: Service_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pallavi
--

SELECT pg_catalog.setval('public."Service_id_seq"', 5, true);


--
-- Name: User_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pallavi
--

SELECT pg_catalog.setval('public."User_id_seq"', 13, true);


--
-- Name: pan_verification_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pallavi
--

SELECT pg_catalog.setval('public.pan_verification_id_seq', 1, false);


--
-- Name: AuthAudit AuthAudit_pkey; Type: CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."AuthAudit"
    ADD CONSTRAINT "AuthAudit_pkey" PRIMARY KEY (id);


--
-- Name: BookingRequest BookingRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."BookingRequest"
    ADD CONSTRAINT "BookingRequest_pkey" PRIMARY KEY (id);


--
-- Name: Booking Booking_pkey; Type: CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."Booking"
    ADD CONSTRAINT "Booking_pkey" PRIMARY KEY (id);


--
-- Name: HelperAvailability HelperAvailability_pkey; Type: CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."HelperAvailability"
    ADD CONSTRAINT "HelperAvailability_pkey" PRIMARY KEY (id);


--
-- Name: HelperBank HelperBank_pkey; Type: CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."HelperBank"
    ADD CONSTRAINT "HelperBank_pkey" PRIMARY KEY (id);


--
-- Name: HelperKyc HelperKyc_pkey; Type: CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."HelperKyc"
    ADD CONSTRAINT "HelperKyc_pkey" PRIMARY KEY (id);


--
-- Name: HelperProfile HelperProfile_pkey; Type: CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."HelperProfile"
    ADD CONSTRAINT "HelperProfile_pkey" PRIMARY KEY (id);


--
-- Name: HelperService HelperService_pkey; Type: CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."HelperService"
    ADD CONSTRAINT "HelperService_pkey" PRIMARY KEY (id);


--
-- Name: Helper Helper_pkey; Type: CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."Helper"
    ADD CONSTRAINT "Helper_pkey" PRIMARY KEY (id);


--
-- Name: OtpSecurity OtpSecurity_pkey; Type: CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."OtpSecurity"
    ADD CONSTRAINT "OtpSecurity_pkey" PRIMARY KEY (id);


--
-- Name: Otp Otp_pkey; Type: CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."Otp"
    ADD CONSTRAINT "Otp_pkey" PRIMARY KEY (id);


--
-- Name: Payment Payment_pkey; Type: CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_pkey" PRIMARY KEY (id);


--
-- Name: PlatformSetting PlatformSetting_pkey; Type: CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."PlatformSetting"
    ADD CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY (id);


--
-- Name: Rating Rating_pkey; Type: CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."Rating"
    ADD CONSTRAINT "Rating_pkey" PRIMARY KEY (id);


--
-- Name: RefreshToken RefreshToken_pkey; Type: CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."RefreshToken"
    ADD CONSTRAINT "RefreshToken_pkey" PRIMARY KEY (id);


--
-- Name: ServicePlan ServicePlan_pkey; Type: CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."ServicePlan"
    ADD CONSTRAINT "ServicePlan_pkey" PRIMARY KEY (id);


--
-- Name: Service Service_pkey; Type: CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."Service"
    ADD CONSTRAINT "Service_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: pan_verification pan_verification_pkey; Type: CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public.pan_verification
    ADD CONSTRAINT pan_verification_pkey PRIMARY KEY (id);


--
-- Name: AuthAudit_createdAt_idx; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE INDEX "AuthAudit_createdAt_idx" ON public."AuthAudit" USING btree ("createdAt");


--
-- Name: AuthAudit_event_idx; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE INDEX "AuthAudit_event_idx" ON public."AuthAudit" USING btree (event);


--
-- Name: AuthAudit_phone_idx; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE INDEX "AuthAudit_phone_idx" ON public."AuthAudit" USING btree (phone);


--
-- Name: AuthAudit_userId_idx; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE INDEX "AuthAudit_userId_idx" ON public."AuthAudit" USING btree ("userId");


--
-- Name: BookingRequest_customerId_idx; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE INDEX "BookingRequest_customerId_idx" ON public."BookingRequest" USING btree ("customerId");


--
-- Name: BookingRequest_expiresAt_idx; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE INDEX "BookingRequest_expiresAt_idx" ON public."BookingRequest" USING btree ("expiresAt");


--
-- Name: BookingRequest_helperId_idx; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE INDEX "BookingRequest_helperId_idx" ON public."BookingRequest" USING btree ("helperId");


--
-- Name: BookingRequest_serviceId_idx; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE INDEX "BookingRequest_serviceId_idx" ON public."BookingRequest" USING btree ("serviceId");


--
-- Name: BookingRequest_status_idx; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE INDEX "BookingRequest_status_idx" ON public."BookingRequest" USING btree (status);


--
-- Name: Booking_bookingRequestId_key; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE UNIQUE INDEX "Booking_bookingRequestId_key" ON public."Booking" USING btree ("bookingRequestId");


--
-- Name: Booking_customerId_idx; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE INDEX "Booking_customerId_idx" ON public."Booking" USING btree ("customerId");


--
-- Name: Booking_helperId_idx; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE INDEX "Booking_helperId_idx" ON public."Booking" USING btree ("helperId");


--
-- Name: Booking_paymentExpiresAt_idx; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE INDEX "Booking_paymentExpiresAt_idx" ON public."Booking" USING btree ("paymentExpiresAt");


--
-- Name: Booking_payoutStatus_idx; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE INDEX "Booking_payoutStatus_idx" ON public."Booking" USING btree ("payoutStatus");


--
-- Name: Booking_reservedHelperId_idx; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE INDEX "Booking_reservedHelperId_idx" ON public."Booking" USING btree ("reservedHelperId");


--
-- Name: Booking_startedAt_idx; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE INDEX "Booking_startedAt_idx" ON public."Booking" USING btree ("startedAt");


--
-- Name: Booking_status_idx; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE INDEX "Booking_status_idx" ON public."Booking" USING btree (status);


--
-- Name: HelperAvailability_helperId_idx; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE INDEX "HelperAvailability_helperId_idx" ON public."HelperAvailability" USING btree ("helperId");


--
-- Name: HelperAvailability_helperId_key; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE UNIQUE INDEX "HelperAvailability_helperId_key" ON public."HelperAvailability" USING btree ("helperId");


--
-- Name: HelperBank_helperId_idx; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE INDEX "HelperBank_helperId_idx" ON public."HelperBank" USING btree ("helperId");


--
-- Name: HelperBank_helperId_key; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE UNIQUE INDEX "HelperBank_helperId_key" ON public."HelperBank" USING btree ("helperId");


--
-- Name: HelperKyc_helperId_idx; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE INDEX "HelperKyc_helperId_idx" ON public."HelperKyc" USING btree ("helperId");


--
-- Name: HelperKyc_helperId_key; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE UNIQUE INDEX "HelperKyc_helperId_key" ON public."HelperKyc" USING btree ("helperId");


--
-- Name: HelperKyc_idfyRequestId_idx; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE INDEX "HelperKyc_idfyRequestId_idx" ON public."HelperKyc" USING btree ("idfyRequestId");


--
-- Name: HelperKyc_idfyRequestId_key; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE UNIQUE INDEX "HelperKyc_idfyRequestId_key" ON public."HelperKyc" USING btree ("idfyRequestId");


--
-- Name: HelperKyc_panNumber_idx; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE INDEX "HelperKyc_panNumber_idx" ON public."HelperKyc" USING btree ("panNumber");


--
-- Name: HelperKyc_panNumber_key; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE UNIQUE INDEX "HelperKyc_panNumber_key" ON public."HelperKyc" USING btree ("panNumber");


--
-- Name: HelperProfile_helperId_idx; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE INDEX "HelperProfile_helperId_idx" ON public."HelperProfile" USING btree ("helperId");


--
-- Name: HelperProfile_helperId_key; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE UNIQUE INDEX "HelperProfile_helperId_key" ON public."HelperProfile" USING btree ("helperId");


--
-- Name: HelperService_helperId_idx; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE INDEX "HelperService_helperId_idx" ON public."HelperService" USING btree ("helperId");


--
-- Name: HelperService_helperId_serviceId_key; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE UNIQUE INDEX "HelperService_helperId_serviceId_key" ON public."HelperService" USING btree ("helperId", "serviceId");


--
-- Name: HelperService_serviceId_idx; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE INDEX "HelperService_serviceId_idx" ON public."HelperService" USING btree ("serviceId");


--
-- Name: Helper_isAvailable_idx; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE INDEX "Helper_isAvailable_idx" ON public."Helper" USING btree ("isAvailable");


--
-- Name: Helper_isOnline_idx; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE INDEX "Helper_isOnline_idx" ON public."Helper" USING btree ("isOnline");


--
-- Name: Helper_onboardingStatus_idx; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE INDEX "Helper_onboardingStatus_idx" ON public."Helper" USING btree ("onboardingStatus");


--
-- Name: Helper_userId_idx; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE INDEX "Helper_userId_idx" ON public."Helper" USING btree ("userId");


--
-- Name: Helper_userId_key; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE UNIQUE INDEX "Helper_userId_key" ON public."Helper" USING btree ("userId");


--
-- Name: OtpSecurity_phone_idx; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE INDEX "OtpSecurity_phone_idx" ON public."OtpSecurity" USING btree (phone);


--
-- Name: OtpSecurity_phone_key; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE UNIQUE INDEX "OtpSecurity_phone_key" ON public."OtpSecurity" USING btree (phone);


--
-- Name: Otp_expiresAt_idx; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE INDEX "Otp_expiresAt_idx" ON public."Otp" USING btree ("expiresAt");


--
-- Name: Otp_phone_idx; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE INDEX "Otp_phone_idx" ON public."Otp" USING btree (phone);


--
-- Name: Payment_bookingId_idx; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE INDEX "Payment_bookingId_idx" ON public."Payment" USING btree ("bookingId");


--
-- Name: Payment_bookingId_key; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE UNIQUE INDEX "Payment_bookingId_key" ON public."Payment" USING btree ("bookingId");


--
-- Name: Payment_escrowStatus_idx; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE INDEX "Payment_escrowStatus_idx" ON public."Payment" USING btree ("escrowStatus");


--
-- Name: Payment_razorpayOrderId_key; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE UNIQUE INDEX "Payment_razorpayOrderId_key" ON public."Payment" USING btree ("razorpayOrderId");


--
-- Name: Payment_razorpayPaymentId_key; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE UNIQUE INDEX "Payment_razorpayPaymentId_key" ON public."Payment" USING btree ("razorpayPaymentId");


--
-- Name: Payment_status_idx; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE INDEX "Payment_status_idx" ON public."Payment" USING btree (status);


--
-- Name: Payment_transactionId_key; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE UNIQUE INDEX "Payment_transactionId_key" ON public."Payment" USING btree ("transactionId");


--
-- Name: Rating_bookingId_key; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE UNIQUE INDEX "Rating_bookingId_key" ON public."Rating" USING btree ("bookingId");


--
-- Name: RefreshToken_expiresAt_idx; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE INDEX "RefreshToken_expiresAt_idx" ON public."RefreshToken" USING btree ("expiresAt");


--
-- Name: RefreshToken_tokenHash_key; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON public."RefreshToken" USING btree ("tokenHash");


--
-- Name: RefreshToken_userId_idx; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE INDEX "RefreshToken_userId_idx" ON public."RefreshToken" USING btree ("userId");


--
-- Name: ServicePlan_serviceId_planType_key; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE UNIQUE INDEX "ServicePlan_serviceId_planType_key" ON public."ServicePlan" USING btree ("serviceId", "planType");


--
-- Name: Service_category_idx; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE INDEX "Service_category_idx" ON public."Service" USING btree (category);


--
-- Name: Service_name_key; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE UNIQUE INDEX "Service_name_key" ON public."Service" USING btree (name);


--
-- Name: User_phone_key; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE UNIQUE INDEX "User_phone_key" ON public."User" USING btree (phone);


--
-- Name: pan_verification_panNumber_key; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE UNIQUE INDEX "pan_verification_panNumber_key" ON public.pan_verification USING btree ("panNumber");


--
-- Name: pan_verification_userId_key; Type: INDEX; Schema: public; Owner: pallavi
--

CREATE UNIQUE INDEX "pan_verification_userId_key" ON public.pan_verification USING btree ("userId");


--
-- Name: BookingRequest BookingRequest_bookingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."BookingRequest"
    ADD CONSTRAINT "BookingRequest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES public."Booking"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BookingRequest BookingRequest_helperId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."BookingRequest"
    ADD CONSTRAINT "BookingRequest_helperId_fkey" FOREIGN KEY ("helperId") REFERENCES public."Helper"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BookingRequest BookingRequest_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."BookingRequest"
    ADD CONSTRAINT "BookingRequest_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public."Service"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Booking Booking_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."Booking"
    ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Booking Booking_helperId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."Booking"
    ADD CONSTRAINT "Booking_helperId_fkey" FOREIGN KEY ("helperId") REFERENCES public."Helper"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Booking Booking_reservedHelperId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."Booking"
    ADD CONSTRAINT "Booking_reservedHelperId_fkey" FOREIGN KEY ("reservedHelperId") REFERENCES public."Helper"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Booking Booking_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."Booking"
    ADD CONSTRAINT "Booking_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public."Service"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Booking Booking_servicePlanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."Booking"
    ADD CONSTRAINT "Booking_servicePlanId_fkey" FOREIGN KEY ("servicePlanId") REFERENCES public."ServicePlan"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: HelperAvailability HelperAvailability_helperId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."HelperAvailability"
    ADD CONSTRAINT "HelperAvailability_helperId_fkey" FOREIGN KEY ("helperId") REFERENCES public."Helper"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: HelperBank HelperBank_helperId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."HelperBank"
    ADD CONSTRAINT "HelperBank_helperId_fkey" FOREIGN KEY ("helperId") REFERENCES public."Helper"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: HelperKyc HelperKyc_helperId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."HelperKyc"
    ADD CONSTRAINT "HelperKyc_helperId_fkey" FOREIGN KEY ("helperId") REFERENCES public."Helper"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: HelperProfile HelperProfile_helperId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."HelperProfile"
    ADD CONSTRAINT "HelperProfile_helperId_fkey" FOREIGN KEY ("helperId") REFERENCES public."Helper"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: HelperService HelperService_helperId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."HelperService"
    ADD CONSTRAINT "HelperService_helperId_fkey" FOREIGN KEY ("helperId") REFERENCES public."Helper"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: HelperService HelperService_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."HelperService"
    ADD CONSTRAINT "HelperService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public."Service"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Helper Helper_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."Helper"
    ADD CONSTRAINT "Helper_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Payment Payment_bookingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES public."Booking"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Rating Rating_bookingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."Rating"
    ADD CONSTRAINT "Rating_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES public."Booking"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Rating Rating_helperId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."Rating"
    ADD CONSTRAINT "Rating_helperId_fkey" FOREIGN KEY ("helperId") REFERENCES public."Helper"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Rating Rating_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."Rating"
    ADD CONSTRAINT "Rating_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RefreshToken RefreshToken_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."RefreshToken"
    ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ServicePlan ServicePlan_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public."ServicePlan"
    ADD CONSTRAINT "ServicePlan_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public."Service"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: pan_verification pan_verification_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pallavi
--

ALTER TABLE ONLY public.pan_verification
    ADD CONSTRAINT "pan_verification_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict pgLy3rqBnlLCiHnec9xlg4VdbbqkM382E4x3trEs6lSPnTWc5qhFKwcJHERM044

