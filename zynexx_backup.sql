--
-- PostgreSQL database dump
--

\restrict CnfcFg1KpojztQoAXmQSJU7JyolVEeW6eUH2vNheoNQIsFsKUo6LcE5jEVRDh06

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.pan_verification DROP CONSTRAINT IF EXISTS "pan_verification_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."UserAddress" DROP CONSTRAINT IF EXISTS "UserAddress_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."SupportTicket" DROP CONSTRAINT IF EXISTS "SupportTicket_helperId_fkey";
ALTER TABLE IF EXISTS ONLY public."ServicePlan" DROP CONSTRAINT IF EXISTS "ServicePlan_serviceId_fkey";
ALTER TABLE IF EXISTS ONLY public."ServiceCoverage" DROP CONSTRAINT IF EXISTS "ServiceCoverage_serviceId_fkey";
ALTER TABLE IF EXISTS ONLY public."ServiceCoverage" DROP CONSTRAINT IF EXISTS "ServiceCoverage_areaId_fkey";
ALTER TABLE IF EXISTS ONLY public."ServiceCategory" DROP CONSTRAINT IF EXISTS "ServiceCategory_platformCategoryId_fkey";
ALTER TABLE IF EXISTS ONLY public."SellerWorker" DROP CONSTRAINT IF EXISTS "SellerWorker_sellerId_fkey";
ALTER TABLE IF EXISTS ONLY public."SellerOrder" DROP CONSTRAINT IF EXISTS "SellerOrder_sellerId_fkey";
ALTER TABLE IF EXISTS ONLY public."RefreshToken" DROP CONSTRAINT IF EXISTS "RefreshToken_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."Rating" DROP CONSTRAINT IF EXISTS "Rating_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."Rating" DROP CONSTRAINT IF EXISTS "Rating_helperId_fkey";
ALTER TABLE IF EXISTS ONLY public."Rating" DROP CONSTRAINT IF EXISTS "Rating_bookingId_fkey";
ALTER TABLE IF EXISTS ONLY public."Payment" DROP CONSTRAINT IF EXISTS "Payment_bookingId_fkey";
ALTER TABLE IF EXISTS ONLY public."NotificationLog" DROP CONSTRAINT IF EXISTS "NotificationLog_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."KiranaProduct" DROP CONSTRAINT IF EXISTS "KiranaProduct_sellerId_fkey";
ALTER TABLE IF EXISTS ONLY public."KiranaProduct" DROP CONSTRAINT IF EXISTS "KiranaProduct_categoryId_fkey";
ALTER TABLE IF EXISTS ONLY public."Helper" DROP CONSTRAINT IF EXISTS "Helper_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."HelperService" DROP CONSTRAINT IF EXISTS "HelperService_serviceId_fkey";
ALTER TABLE IF EXISTS ONLY public."HelperService" DROP CONSTRAINT IF EXISTS "HelperService_helperId_fkey";
ALTER TABLE IF EXISTS ONLY public."HelperProfile" DROP CONSTRAINT IF EXISTS "HelperProfile_helperId_fkey";
ALTER TABLE IF EXISTS ONLY public."HelperLocation" DROP CONSTRAINT IF EXISTS "HelperLocation_helperId_fkey";
ALTER TABLE IF EXISTS ONLY public."HelperKyc" DROP CONSTRAINT IF EXISTS "HelperKyc_helperId_fkey";
ALTER TABLE IF EXISTS ONLY public."HelperBank" DROP CONSTRAINT IF EXISTS "HelperBank_helperId_fkey";
ALTER TABLE IF EXISTS ONLY public."HelperAvailability" DROP CONSTRAINT IF EXISTS "HelperAvailability_helperId_fkey";
ALTER TABLE IF EXISTS ONLY public."FAQ" DROP CONSTRAINT IF EXISTS "FAQ_categoryId_fkey";
ALTER TABLE IF EXISTS ONLY public."Dispute" DROP CONSTRAINT IF EXISTS "Dispute_categoryId_fkey";
ALTER TABLE IF EXISTS ONLY public."DeviceToken" DROP CONSTRAINT IF EXISTS "DeviceToken_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."Coupon" DROP CONSTRAINT IF EXISTS "Coupon_categoryId_fkey";
ALTER TABLE IF EXISTS ONLY public."Booking" DROP CONSTRAINT IF EXISTS "Booking_servicePlanId_fkey";
ALTER TABLE IF EXISTS ONLY public."Booking" DROP CONSTRAINT IF EXISTS "Booking_serviceId_fkey";
ALTER TABLE IF EXISTS ONLY public."Booking" DROP CONSTRAINT IF EXISTS "Booking_reservedHelperId_fkey";
ALTER TABLE IF EXISTS ONLY public."Booking" DROP CONSTRAINT IF EXISTS "Booking_helperId_fkey";
ALTER TABLE IF EXISTS ONLY public."Booking" DROP CONSTRAINT IF EXISTS "Booking_customerId_fkey";
ALTER TABLE IF EXISTS ONLY public."BookingWorkPhoto" DROP CONSTRAINT IF EXISTS "BookingWorkPhoto_bookingId_fkey";
ALTER TABLE IF EXISTS ONLY public."BookingRequest" DROP CONSTRAINT IF EXISTS "BookingRequest_servicePlanId_fkey";
ALTER TABLE IF EXISTS ONLY public."BookingRequest" DROP CONSTRAINT IF EXISTS "BookingRequest_serviceId_fkey";
ALTER TABLE IF EXISTS ONLY public."BookingRequest" DROP CONSTRAINT IF EXISTS "BookingRequest_helperId_fkey";
ALTER TABLE IF EXISTS ONLY public."BookingRequest" DROP CONSTRAINT IF EXISTS "BookingRequest_bookingId_fkey";
ALTER TABLE IF EXISTS ONLY public."BookingIssue" DROP CONSTRAINT IF EXISTS "BookingIssue_bookingId_fkey";
ALTER TABLE IF EXISTS ONLY public."Area" DROP CONSTRAINT IF EXISTS "Area_cityId_fkey";
DROP INDEX IF EXISTS public."pan_verification_userId_key";
DROP INDEX IF EXISTS public."pan_verification_panNumber_key";
DROP INDEX IF EXISTS public.idx_worker_seller_id;
DROP INDEX IF EXISTS public.idx_worker_email;
DROP INDEX IF EXISTS public.idx_user_email_unique;
DROP INDEX IF EXISTS public.idx_service_cat_platform_id;
DROP INDEX IF EXISTS public."idx_seller_worker_workerId";
DROP INDEX IF EXISTS public."idx_seller_worker_sellerId";
DROP INDEX IF EXISTS public.idx_seller_order_worker_id;
DROP INDEX IF EXISTS public.idx_seller_order_cat_id;
DROP INDEX IF EXISTS public.idx_seller_category_id;
DROP INDEX IF EXISTS public.idx_platform_otp_email_purpose;
DROP INDEX IF EXISTS public.idx_platform_cat_slug;
DROP INDEX IF EXISTS public.idx_platform_cat_active;
DROP INDEX IF EXISTS public.idx_notification_recip;
DROP INDEX IF EXISTS public.idx_faq_category;
DROP INDEX IF EXISTS public.idx_faq_cat_id;
DROP INDEX IF EXISTS public.idx_dispute_category_id;
DROP INDEX IF EXISTS public.idx_coupon_category_id;
DROP INDEX IF EXISTS public.idx_announcement_created;
DROP INDEX IF EXISTS public."User_phone_key";
DROP INDEX IF EXISTS public."UserAddress_userId_idx";
DROP INDEX IF EXISTS public."SupportTicket_status_idx";
DROP INDEX IF EXISTS public."SupportTicket_helperId_idx";
DROP INDEX IF EXISTS public."SupportTicket_createdAt_idx";
DROP INDEX IF EXISTS public."ServicePlan_serviceId_idx";
DROP INDEX IF EXISTS public."ServiceCoverage_serviceId_areaId_key";
DROP INDEX IF EXISTS public."ServiceCoverage_areaId_idx";
DROP INDEX IF EXISTS public."Seller_status_idx";
DROP INDEX IF EXISTS public."Seller_pincode_idx";
DROP INDEX IF EXISTS public."Seller_phone_key";
DROP INDEX IF EXISTS public."Seller_email_key";
DROP INDEX IF EXISTS public."Seller_city_idx";
DROP INDEX IF EXISTS public."Seller_businessType_idx";
DROP INDEX IF EXISTS public."SellerOrder_status_idx";
DROP INDEX IF EXISTS public."SellerOrder_sellerId_idx";
DROP INDEX IF EXISTS public."SellerOrder_orderNumber_key";
DROP INDEX IF EXISTS public."SellerOrder_orderNumber_idx";
DROP INDEX IF EXISTS public."RefreshToken_userId_idx";
DROP INDEX IF EXISTS public."RefreshToken_tokenHash_key";
DROP INDEX IF EXISTS public."RefreshToken_expiresAt_idx";
DROP INDEX IF EXISTS public."Rating_bookingId_key";
DROP INDEX IF EXISTS public."Payment_transactionId_key";
DROP INDEX IF EXISTS public."Payment_status_idx";
DROP INDEX IF EXISTS public."Payment_razorpayPaymentId_key";
DROP INDEX IF EXISTS public."Payment_razorpayOrderId_key";
DROP INDEX IF EXISTS public."Payment_escrowStatus_idx";
DROP INDEX IF EXISTS public."Payment_bookingId_key";
DROP INDEX IF EXISTS public."Payment_bookingId_idx";
DROP INDEX IF EXISTS public."Otp_phone_idx";
DROP INDEX IF EXISTS public."Otp_expiresAt_idx";
DROP INDEX IF EXISTS public."OtpSecurity_phone_key";
DROP INDEX IF EXISTS public."OtpSecurity_phone_idx";
DROP INDEX IF EXISTS public."NotificationLog_userId_idx";
DROP INDEX IF EXISTS public."NotificationLog_type_idx";
DROP INDEX IF EXISTS public."NotificationLog_isRead_idx";
DROP INDEX IF EXISTS public."LedgerEntry_userId_idx";
DROP INDEX IF EXISTS public."LedgerEntry_type_referenceId_key";
DROP INDEX IF EXISTS public."LedgerEntry_type_idx";
DROP INDEX IF EXISTS public."LedgerEntry_createdAt_idx";
DROP INDEX IF EXISTS public."LedgerEntry_bookingId_idx";
DROP INDEX IF EXISTS public."LaundryCatalogService_slug_key";
DROP INDEX IF EXISTS public."LaundryCatalogService_slug_idx";
DROP INDEX IF EXISTS public."LaundryCatalogItem_category_idx";
DROP INDEX IF EXISTS public."KiranaProduct_slug_key";
DROP INDEX IF EXISTS public."KiranaProduct_slug_idx";
DROP INDEX IF EXISTS public."KiranaProduct_sellerId_idx";
DROP INDEX IF EXISTS public."KiranaProduct_isFeatured_idx";
DROP INDEX IF EXISTS public."KiranaProduct_isBestseller_idx";
DROP INDEX IF EXISTS public."KiranaProduct_categoryId_idx";
DROP INDEX IF EXISTS public."KiranaCategory_slug_key";
DROP INDEX IF EXISTS public."KiranaCategory_slug_idx";
DROP INDEX IF EXISTS public."KiranaCategory_isActive_idx";
DROP INDEX IF EXISTS public."Helper_userId_key";
DROP INDEX IF EXISTS public."Helper_userId_idx";
DROP INDEX IF EXISTS public."Helper_payoutSetupStatus_idx";
DROP INDEX IF EXISTS public."Helper_onboardingStatus_idx";
DROP INDEX IF EXISTS public."Helper_isOnline_idx";
DROP INDEX IF EXISTS public."Helper_isAvailable_idx";
DROP INDEX IF EXISTS public."HelperService_serviceId_idx";
DROP INDEX IF EXISTS public."HelperService_helperId_serviceId_key";
DROP INDEX IF EXISTS public."HelperService_helperId_idx";
DROP INDEX IF EXISTS public."HelperProfile_helperId_key";
DROP INDEX IF EXISTS public."HelperProfile_helperId_idx";
DROP INDEX IF EXISTS public."HelperLocation_helperId_key";
DROP INDEX IF EXISTS public."HelperLocation_helperId_idx";
DROP INDEX IF EXISTS public."HelperKyc_panNumber_key";
DROP INDEX IF EXISTS public."HelperKyc_panNumber_idx";
DROP INDEX IF EXISTS public."HelperKyc_idfyRequestId_key";
DROP INDEX IF EXISTS public."HelperKyc_idfyRequestId_idx";
DROP INDEX IF EXISTS public."HelperKyc_helperId_key";
DROP INDEX IF EXISTS public."HelperKyc_helperId_idx";
DROP INDEX IF EXISTS public."HelperBank_helperId_key";
DROP INDEX IF EXISTS public."HelperBank_helperId_idx";
DROP INDEX IF EXISTS public."HelperAvailability_helperId_key";
DROP INDEX IF EXISTS public."HelperAvailability_helperId_idx";
DROP INDEX IF EXISTS public."Dispute_ticketId_key";
DROP INDEX IF EXISTS public."Dispute_ticketId_idx";
DROP INDEX IF EXISTS public."Dispute_status_idx";
DROP INDEX IF EXISTS public."DeviceToken_userId_idx";
DROP INDEX IF EXISTS public."DeviceToken_token_key";
DROP INDEX IF EXISTS public."Coupon_isActive_idx";
DROP INDEX IF EXISTS public."Coupon_code_key";
DROP INDEX IF EXISTS public."Coupon_code_idx";
DROP INDEX IF EXISTS public."Booking_status_idx";
DROP INDEX IF EXISTS public."Booking_startedAt_idx";
DROP INDEX IF EXISTS public."Booking_reservedHelperId_idx";
DROP INDEX IF EXISTS public."Booking_payoutStatus_idx";
DROP INDEX IF EXISTS public."Booking_paymentExpiresAt_idx";
DROP INDEX IF EXISTS public."Booking_helperId_idx";
DROP INDEX IF EXISTS public."Booking_customerId_idx";
DROP INDEX IF EXISTS public."Booking_bookingRequestId_key";
DROP INDEX IF EXISTS public."BookingWorkPhoto_bookingId_type_idx";
DROP INDEX IF EXISTS public."BookingWorkPhoto_bookingId_idx";
DROP INDEX IF EXISTS public."BookingRequest_status_idx";
DROP INDEX IF EXISTS public."BookingRequest_serviceId_idx";
DROP INDEX IF EXISTS public."BookingRequest_helperId_idx";
DROP INDEX IF EXISTS public."BookingRequest_expiresAt_idx";
DROP INDEX IF EXISTS public."BookingRequest_customerId_idx";
DROP INDEX IF EXISTS public."BookingIssue_resolved_idx";
DROP INDEX IF EXISTS public."BookingIssue_helperId_idx";
DROP INDEX IF EXISTS public."BookingIssue_bookingId_idx";
DROP INDEX IF EXISTS public."AuthAudit_userId_idx";
DROP INDEX IF EXISTS public."AuthAudit_phone_idx";
DROP INDEX IF EXISTS public."AuthAudit_event_idx";
DROP INDEX IF EXISTS public."AuthAudit_createdAt_idx";
DROP INDEX IF EXISTS public."Area_pincode_idx";
ALTER TABLE IF EXISTS ONLY public.pan_verification DROP CONSTRAINT IF EXISTS pan_verification_pkey;
ALTER TABLE IF EXISTS ONLY public."User" DROP CONSTRAINT IF EXISTS "User_pkey";
ALTER TABLE IF EXISTS ONLY public."UserAddress" DROP CONSTRAINT IF EXISTS "UserAddress_pkey";
ALTER TABLE IF EXISTS ONLY public."SupportTicket" DROP CONSTRAINT IF EXISTS "SupportTicket_pkey";
ALTER TABLE IF EXISTS ONLY public."Service" DROP CONSTRAINT IF EXISTS "Service_pkey";
ALTER TABLE IF EXISTS ONLY public."ServicePlan" DROP CONSTRAINT IF EXISTS "ServicePlan_pkey";
ALTER TABLE IF EXISTS ONLY public."ServiceCoverage" DROP CONSTRAINT IF EXISTS "ServiceCoverage_pkey";
ALTER TABLE IF EXISTS ONLY public."ServiceCategory" DROP CONSTRAINT IF EXISTS "ServiceCategory_pkey";
ALTER TABLE IF EXISTS ONLY public."ServiceCategory" DROP CONSTRAINT IF EXISTS "ServiceCategory_name_key";
ALTER TABLE IF EXISTS ONLY public."Seller" DROP CONSTRAINT IF EXISTS "Seller_pkey";
ALTER TABLE IF EXISTS ONLY public."SellerWorker" DROP CONSTRAINT IF EXISTS "SellerWorker_workerId_key";
ALTER TABLE IF EXISTS ONLY public."SellerWorker" DROP CONSTRAINT IF EXISTS "SellerWorker_pkey";
ALTER TABLE IF EXISTS ONLY public."SellerOrder" DROP CONSTRAINT IF EXISTS "SellerOrder_pkey";
ALTER TABLE IF EXISTS ONLY public."RefreshToken" DROP CONSTRAINT IF EXISTS "RefreshToken_pkey";
ALTER TABLE IF EXISTS ONLY public."Rating" DROP CONSTRAINT IF EXISTS "Rating_pkey";
ALTER TABLE IF EXISTS ONLY public."PlatformSetting" DROP CONSTRAINT IF EXISTS "PlatformSetting_pkey";
ALTER TABLE IF EXISTS ONLY public."PlatformOtp" DROP CONSTRAINT IF EXISTS "PlatformOtp_pkey";
ALTER TABLE IF EXISTS ONLY public."PlatformNotification" DROP CONSTRAINT IF EXISTS "PlatformNotification_pkey";
ALTER TABLE IF EXISTS ONLY public."PlatformCategory" DROP CONSTRAINT IF EXISTS "PlatformCategory_slug_key";
ALTER TABLE IF EXISTS ONLY public."PlatformCategory" DROP CONSTRAINT IF EXISTS "PlatformCategory_pkey";
ALTER TABLE IF EXISTS ONLY public."PlatformAnnouncement" DROP CONSTRAINT IF EXISTS "PlatformAnnouncement_pkey";
ALTER TABLE IF EXISTS ONLY public."Payment" DROP CONSTRAINT IF EXISTS "Payment_pkey";
ALTER TABLE IF EXISTS ONLY public."Otp" DROP CONSTRAINT IF EXISTS "Otp_pkey";
ALTER TABLE IF EXISTS ONLY public."OtpSecurity" DROP CONSTRAINT IF EXISTS "OtpSecurity_pkey";
ALTER TABLE IF EXISTS ONLY public."NotificationLog" DROP CONSTRAINT IF EXISTS "NotificationLog_pkey";
ALTER TABLE IF EXISTS ONLY public."LedgerEntry" DROP CONSTRAINT IF EXISTS "LedgerEntry_pkey";
ALTER TABLE IF EXISTS ONLY public."LaundryCatalogService" DROP CONSTRAINT IF EXISTS "LaundryCatalogService_pkey";
ALTER TABLE IF EXISTS ONLY public."LaundryCatalogItem" DROP CONSTRAINT IF EXISTS "LaundryCatalogItem_pkey";
ALTER TABLE IF EXISTS ONLY public."KiranaProduct" DROP CONSTRAINT IF EXISTS "KiranaProduct_pkey";
ALTER TABLE IF EXISTS ONLY public."KiranaCategory" DROP CONSTRAINT IF EXISTS "KiranaCategory_pkey";
ALTER TABLE IF EXISTS ONLY public."Helper" DROP CONSTRAINT IF EXISTS "Helper_pkey";
ALTER TABLE IF EXISTS ONLY public."HelperService" DROP CONSTRAINT IF EXISTS "HelperService_pkey";
ALTER TABLE IF EXISTS ONLY public."HelperProfile" DROP CONSTRAINT IF EXISTS "HelperProfile_pkey";
ALTER TABLE IF EXISTS ONLY public."HelperLocation" DROP CONSTRAINT IF EXISTS "HelperLocation_pkey";
ALTER TABLE IF EXISTS ONLY public."HelperKyc" DROP CONSTRAINT IF EXISTS "HelperKyc_pkey";
ALTER TABLE IF EXISTS ONLY public."HelperBank" DROP CONSTRAINT IF EXISTS "HelperBank_pkey";
ALTER TABLE IF EXISTS ONLY public."HelperAvailability" DROP CONSTRAINT IF EXISTS "HelperAvailability_pkey";
ALTER TABLE IF EXISTS ONLY public."FAQ" DROP CONSTRAINT IF EXISTS "FAQ_pkey";
ALTER TABLE IF EXISTS ONLY public."Dispute" DROP CONSTRAINT IF EXISTS "Dispute_pkey";
ALTER TABLE IF EXISTS ONLY public."DeviceToken" DROP CONSTRAINT IF EXISTS "DeviceToken_pkey";
ALTER TABLE IF EXISTS ONLY public."Coupon" DROP CONSTRAINT IF EXISTS "Coupon_pkey";
ALTER TABLE IF EXISTS ONLY public."City" DROP CONSTRAINT IF EXISTS "City_pkey";
ALTER TABLE IF EXISTS ONLY public."Booking" DROP CONSTRAINT IF EXISTS "Booking_pkey";
ALTER TABLE IF EXISTS ONLY public."BookingWorkPhoto" DROP CONSTRAINT IF EXISTS "BookingWorkPhoto_pkey";
ALTER TABLE IF EXISTS ONLY public."BookingRequest" DROP CONSTRAINT IF EXISTS "BookingRequest_pkey";
ALTER TABLE IF EXISTS ONLY public."BookingIssue" DROP CONSTRAINT IF EXISTS "BookingIssue_pkey";
ALTER TABLE IF EXISTS ONLY public."AuthAudit" DROP CONSTRAINT IF EXISTS "AuthAudit_pkey";
ALTER TABLE IF EXISTS ONLY public."Area" DROP CONSTRAINT IF EXISTS "Area_pkey";
ALTER TABLE IF EXISTS public.pan_verification ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."UserAddress" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."User" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."SupportTicket" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."ServicePlan" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."ServiceCoverage" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."ServiceCategory" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."Service" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."SellerWorker" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."SellerOrder" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."Seller" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."RefreshToken" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."Rating" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."PlatformOtp" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."PlatformNotification" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."PlatformCategory" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."PlatformAnnouncement" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."Payment" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."OtpSecurity" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."Otp" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."NotificationLog" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."LedgerEntry" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."LaundryCatalogService" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."LaundryCatalogItem" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."KiranaProduct" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."KiranaCategory" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."HelperService" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."HelperProfile" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."HelperLocation" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."HelperKyc" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."HelperBank" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."HelperAvailability" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."Helper" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."FAQ" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."Dispute" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."DeviceToken" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."Coupon" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."City" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."BookingWorkPhoto" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."BookingRequest" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."BookingIssue" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."Booking" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."AuthAudit" ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public."Area" ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.pan_verification_id_seq;
DROP TABLE IF EXISTS public.pan_verification;
DROP SEQUENCE IF EXISTS public."User_id_seq";
DROP SEQUENCE IF EXISTS public."UserAddress_id_seq";
DROP TABLE IF EXISTS public."UserAddress";
DROP TABLE IF EXISTS public."User";
DROP SEQUENCE IF EXISTS public."SupportTicket_id_seq";
DROP TABLE IF EXISTS public."SupportTicket";
DROP SEQUENCE IF EXISTS public."Service_id_seq";
DROP SEQUENCE IF EXISTS public."ServicePlan_id_seq";
DROP TABLE IF EXISTS public."ServicePlan";
DROP SEQUENCE IF EXISTS public."ServiceCoverage_id_seq";
DROP TABLE IF EXISTS public."ServiceCoverage";
DROP SEQUENCE IF EXISTS public."ServiceCategory_id_seq";
DROP TABLE IF EXISTS public."ServiceCategory";
DROP TABLE IF EXISTS public."Service";
DROP SEQUENCE IF EXISTS public."Seller_id_seq";
DROP SEQUENCE IF EXISTS public."SellerWorker_id_seq";
DROP TABLE IF EXISTS public."SellerWorker";
DROP SEQUENCE IF EXISTS public."SellerOrder_id_seq";
DROP TABLE IF EXISTS public."SellerOrder";
DROP TABLE IF EXISTS public."Seller";
DROP SEQUENCE IF EXISTS public."RefreshToken_id_seq";
DROP TABLE IF EXISTS public."RefreshToken";
DROP SEQUENCE IF EXISTS public."Rating_id_seq";
DROP TABLE IF EXISTS public."Rating";
DROP TABLE IF EXISTS public."PlatformSetting";
DROP SEQUENCE IF EXISTS public."PlatformOtp_id_seq";
DROP TABLE IF EXISTS public."PlatformOtp";
DROP SEQUENCE IF EXISTS public."PlatformNotification_id_seq";
DROP TABLE IF EXISTS public."PlatformNotification";
DROP SEQUENCE IF EXISTS public."PlatformCategory_id_seq";
DROP TABLE IF EXISTS public."PlatformCategory";
DROP SEQUENCE IF EXISTS public."PlatformAnnouncement_id_seq";
DROP TABLE IF EXISTS public."PlatformAnnouncement";
DROP SEQUENCE IF EXISTS public."Payment_id_seq";
DROP TABLE IF EXISTS public."Payment";
DROP SEQUENCE IF EXISTS public."Otp_id_seq";
DROP SEQUENCE IF EXISTS public."OtpSecurity_id_seq";
DROP TABLE IF EXISTS public."OtpSecurity";
DROP TABLE IF EXISTS public."Otp";
DROP SEQUENCE IF EXISTS public."NotificationLog_id_seq";
DROP TABLE IF EXISTS public."NotificationLog";
DROP SEQUENCE IF EXISTS public."LedgerEntry_id_seq";
DROP TABLE IF EXISTS public."LedgerEntry";
DROP SEQUENCE IF EXISTS public."LaundryCatalogService_id_seq";
DROP TABLE IF EXISTS public."LaundryCatalogService";
DROP SEQUENCE IF EXISTS public."LaundryCatalogItem_id_seq";
DROP TABLE IF EXISTS public."LaundryCatalogItem";
DROP SEQUENCE IF EXISTS public."KiranaProduct_id_seq";
DROP TABLE IF EXISTS public."KiranaProduct";
DROP SEQUENCE IF EXISTS public."KiranaCategory_id_seq";
DROP TABLE IF EXISTS public."KiranaCategory";
DROP SEQUENCE IF EXISTS public."Helper_id_seq";
DROP SEQUENCE IF EXISTS public."HelperService_id_seq";
DROP TABLE IF EXISTS public."HelperService";
DROP SEQUENCE IF EXISTS public."HelperProfile_id_seq";
DROP TABLE IF EXISTS public."HelperProfile";
DROP SEQUENCE IF EXISTS public."HelperLocation_id_seq";
DROP TABLE IF EXISTS public."HelperLocation";
DROP SEQUENCE IF EXISTS public."HelperKyc_id_seq";
DROP TABLE IF EXISTS public."HelperKyc";
DROP SEQUENCE IF EXISTS public."HelperBank_id_seq";
DROP TABLE IF EXISTS public."HelperBank";
DROP SEQUENCE IF EXISTS public."HelperAvailability_id_seq";
DROP TABLE IF EXISTS public."HelperAvailability";
DROP TABLE IF EXISTS public."Helper";
DROP SEQUENCE IF EXISTS public."FAQ_id_seq";
DROP TABLE IF EXISTS public."FAQ";
DROP SEQUENCE IF EXISTS public."Dispute_id_seq";
DROP TABLE IF EXISTS public."Dispute";
DROP SEQUENCE IF EXISTS public."DeviceToken_id_seq";
DROP TABLE IF EXISTS public."DeviceToken";
DROP SEQUENCE IF EXISTS public."Coupon_id_seq";
DROP TABLE IF EXISTS public."Coupon";
DROP SEQUENCE IF EXISTS public."City_id_seq";
DROP TABLE IF EXISTS public."City";
DROP SEQUENCE IF EXISTS public."Booking_id_seq";
DROP SEQUENCE IF EXISTS public."BookingWorkPhoto_id_seq";
DROP TABLE IF EXISTS public."BookingWorkPhoto";
DROP SEQUENCE IF EXISTS public."BookingRequest_id_seq";
DROP TABLE IF EXISTS public."BookingRequest";
DROP SEQUENCE IF EXISTS public."BookingIssue_id_seq";
DROP TABLE IF EXISTS public."BookingIssue";
DROP TABLE IF EXISTS public."Booking";
DROP SEQUENCE IF EXISTS public."AuthAudit_id_seq";
DROP TABLE IF EXISTS public."AuthAudit";
DROP SEQUENCE IF EXISTS public."Area_id_seq";
DROP TABLE IF EXISTS public."Area";
DROP TYPE IF EXISTS public."WorkPhotoType";
DROP TYPE IF EXISTS public."UserRole";
DROP TYPE IF EXISTS public."SellerStatus";
DROP TYPE IF EXISTS public."PayoutStatus";
DROP TYPE IF EXISTS public."PaymentStatus";
DROP TYPE IF EXISTS public."OnboardingStatus";
DROP TYPE IF EXISTS public."LedgerType";
DROP TYPE IF EXISTS public."LedgerDirection";
DROP TYPE IF EXISTS public."EscrowStatus";
DROP TYPE IF EXISTS public."DurationUnit";
DROP TYPE IF EXISTS public."BookingStatus";
--
-- Name: BookingStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."BookingStatus" AS ENUM (
    'PENDING_PAYMENT',
    'CONFIRMED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'EXPIRED',
    'NO_SHOW'
);


ALTER TYPE public."BookingStatus" OWNER TO postgres;

--
-- Name: DurationUnit; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."DurationUnit" AS ENUM (
    'HOUR',
    'DAY',
    'WEEK',
    'MONTH'
);


ALTER TYPE public."DurationUnit" OWNER TO postgres;

--
-- Name: EscrowStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."EscrowStatus" AS ENUM (
    'PENDING',
    'LOCKED',
    'RELEASED',
    'REFUNDED'
);


ALTER TYPE public."EscrowStatus" OWNER TO postgres;

--
-- Name: LedgerDirection; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."LedgerDirection" AS ENUM (
    'CREDIT',
    'DEBIT'
);


ALTER TYPE public."LedgerDirection" OWNER TO postgres;

--
-- Name: LedgerType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."LedgerType" AS ENUM (
    'PAYMENT_CAPTURED',
    'ESCROW_LOCK',
    'COMMISSION_EARNED',
    'HELPER_PAYOUT',
    'REFUND_ISSUED',
    'PAYOUT_REVERSAL'
);


ALTER TYPE public."LedgerType" OWNER TO postgres;

--
-- Name: OnboardingStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."OnboardingStatus" AS ENUM (
    'PENDING_KYC',
    'PENDING_APPROVAL',
    'APPROVED',
    'REJECTED'
);


ALTER TYPE public."OnboardingStatus" OWNER TO postgres;

--
-- Name: PaymentStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."PaymentStatus" AS ENUM (
    'CREATED',
    'AUTHORIZED',
    'CAPTURED',
    'FAILED',
    'REFUNDED'
);


ALTER TYPE public."PaymentStatus" OWNER TO postgres;

--
-- Name: PayoutStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."PayoutStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'PAID',
    'FAILED',
    'CANCELLED'
);


ALTER TYPE public."PayoutStatus" OWNER TO postgres;

--
-- Name: SellerStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."SellerStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'SUSPENDED'
);


ALTER TYPE public."SellerStatus" OWNER TO postgres;

--
-- Name: UserRole; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."UserRole" AS ENUM (
    'CUSTOMER',
    'HELPER',
    'ADMIN'
);


ALTER TYPE public."UserRole" OWNER TO postgres;

--
-- Name: WorkPhotoType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."WorkPhotoType" AS ENUM (
    'BEFORE',
    'AFTER'
);


ALTER TYPE public."WorkPhotoType" OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Area; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Area" (
    id integer NOT NULL,
    name text NOT NULL,
    pincode text NOT NULL,
    "cityId" integer NOT NULL
);


ALTER TABLE public."Area" OWNER TO postgres;

--
-- Name: Area_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Area_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Area_id_seq" OWNER TO postgres;

--
-- Name: Area_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Area_id_seq" OWNED BY public."Area".id;


--
-- Name: AuthAudit; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."AuthAudit" (
    id integer NOT NULL,
    "userId" integer,
    phone text NOT NULL,
    event text NOT NULL,
    ip text,
    "userAgent" text,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."AuthAudit" OWNER TO postgres;

--
-- Name: AuthAudit_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."AuthAudit_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."AuthAudit_id_seq" OWNER TO postgres;

--
-- Name: AuthAudit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."AuthAudit_id_seq" OWNED BY public."AuthAudit".id;


--
-- Name: Booking; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Booking" (
    id integer NOT NULL,
    "customerId" integer NOT NULL,
    "serviceId" integer NOT NULL,
    "servicePlanId" integer NOT NULL,
    "helperId" integer,
    "reservedHelperId" integer,
    "reservedAt" timestamp(3) with time zone,
    "bookingDate" timestamp(3) with time zone NOT NULL,
    "startTime" timestamp(3) with time zone,
    "endTime" timestamp(3) with time zone,
    duration integer NOT NULL,
    "totalHours" integer,
    "paymentExpiresAt" timestamp(3) with time zone,
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
    "otpGeneratedAt" timestamp(3) with time zone,
    "otpAttempts" integer DEFAULT 0 NOT NULL,
    "startedAt" timestamp(3) with time zone,
    "endedAt" timestamp(3) with time zone,
    "completedAt" timestamp(3) with time zone,
    "jobTimerStarted" boolean DEFAULT false NOT NULL,
    "jobStartedAt" timestamp(3) with time zone,
    "cancelReason" text,
    "cancelledBy" text,
    "refundAmount" double precision,
    "refundedAt" timestamp(3) with time zone,
    "totalAmount" double precision NOT NULL,
    "platformFee" double precision DEFAULT 0 NOT NULL,
    tax double precision DEFAULT 0 NOT NULL,
    "finalAmount" double precision NOT NULL,
    "payoutStatus" public."PayoutStatus" DEFAULT 'PENDING'::public."PayoutStatus" NOT NULL,
    "payoutEligibleAt" timestamp(3) with time zone,
    "payoutId" text,
    "payoutAt" timestamp(3) with time zone,
    "retryCount" integer DEFAULT 0 NOT NULL,
    "lastRetryAt" timestamp(3) with time zone,
    "nextRetryAt" timestamp(3) with time zone,
    "commissionRateSnapshot" double precision,
    "platformCommissionAmount" double precision,
    "helperPayoutAmount" double precision,
    "bookingRequestId" text,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) with time zone NOT NULL
);


ALTER TABLE public."Booking" OWNER TO postgres;

--
-- Name: BookingIssue; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."BookingIssue" (
    id integer NOT NULL,
    "bookingId" integer NOT NULL,
    "helperId" integer NOT NULL,
    reason text NOT NULL,
    notes text,
    resolved boolean DEFAULT false NOT NULL,
    "resolvedAt" timestamp(3) with time zone,
    "resolvedBy" text,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."BookingIssue" OWNER TO postgres;

--
-- Name: BookingIssue_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."BookingIssue_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."BookingIssue_id_seq" OWNER TO postgres;

--
-- Name: BookingIssue_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."BookingIssue_id_seq" OWNED BY public."BookingIssue".id;


--
-- Name: BookingRequest; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."BookingRequest" (
    id integer NOT NULL,
    "customerId" integer NOT NULL,
    "bookingId" integer,
    "helperId" integer,
    "serviceId" integer NOT NULL,
    "servicePlanId" integer NOT NULL,
    address text NOT NULL,
    city text NOT NULL,
    "pinCode" text NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    "requestedDate" timestamp(3) with time zone NOT NULL,
    "requestedTime" text,
    "estimatedHours" integer NOT NULL,
    description text,
    "specialRequirements" text,
    notes text,
    "totalAmount" double precision NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "dispatchedHelperIds" integer[] DEFAULT ARRAY[]::integer[],
    "expiresAt" timestamp(3) with time zone,
    "respondedAt" timestamp(3) with time zone,
    "rejectionReason" text,
    "rejectedAt" timestamp(3) with time zone,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) with time zone NOT NULL
);


ALTER TABLE public."BookingRequest" OWNER TO postgres;

--
-- Name: BookingRequest_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."BookingRequest_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."BookingRequest_id_seq" OWNER TO postgres;

--
-- Name: BookingRequest_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."BookingRequest_id_seq" OWNED BY public."BookingRequest".id;


--
-- Name: BookingWorkPhoto; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."BookingWorkPhoto" (
    id integer NOT NULL,
    "bookingId" integer NOT NULL,
    "photoUrl" text NOT NULL,
    type public."WorkPhotoType" NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."BookingWorkPhoto" OWNER TO postgres;

--
-- Name: BookingWorkPhoto_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."BookingWorkPhoto_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."BookingWorkPhoto_id_seq" OWNER TO postgres;

--
-- Name: BookingWorkPhoto_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."BookingWorkPhoto_id_seq" OWNED BY public."BookingWorkPhoto".id;


--
-- Name: Booking_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Booking_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Booking_id_seq" OWNER TO postgres;

--
-- Name: Booking_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Booking_id_seq" OWNED BY public."Booking".id;


--
-- Name: City; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."City" (
    id integer NOT NULL,
    name text NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."City" OWNER TO postgres;

--
-- Name: City_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."City_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."City_id_seq" OWNER TO postgres;

--
-- Name: City_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."City_id_seq" OWNED BY public."City".id;


--
-- Name: Coupon; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Coupon" (
    id integer NOT NULL,
    code text NOT NULL,
    title text,
    description text,
    "discountType" text DEFAULT 'PERCENT'::text NOT NULL,
    "discountValue" double precision NOT NULL,
    "minOrderValue" double precision DEFAULT 0,
    "maxDiscount" double precision,
    "usageLimit" integer,
    "usedCount" integer DEFAULT 0 NOT NULL,
    "validFrom" timestamp(3) with time zone,
    "validUntil" timestamp(3) with time zone,
    "bgColor" text DEFAULT '#0B2239'::text,
    "textColor" text DEFAULT '#ffffff'::text,
    "isActive" boolean DEFAULT true NOT NULL,
    "isFirstUserOnly" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) with time zone NOT NULL,
    "categoryId" integer
);


ALTER TABLE public."Coupon" OWNER TO postgres;

--
-- Name: Coupon_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Coupon_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Coupon_id_seq" OWNER TO postgres;

--
-- Name: Coupon_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Coupon_id_seq" OWNED BY public."Coupon".id;


--
-- Name: DeviceToken; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."DeviceToken" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    token text NOT NULL,
    platform text NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."DeviceToken" OWNER TO postgres;

--
-- Name: DeviceToken_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."DeviceToken_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."DeviceToken_id_seq" OWNER TO postgres;

--
-- Name: DeviceToken_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."DeviceToken_id_seq" OWNED BY public."DeviceToken".id;


--
-- Name: Dispute; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Dispute" (
    id integer NOT NULL,
    "ticketId" text NOT NULL,
    "orderId" text,
    type text DEFAULT 'customer'::text NOT NULL,
    "reportedBy" text NOT NULL,
    against text,
    issue text NOT NULL,
    description text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    priority text DEFAULT 'medium'::text NOT NULL,
    resolution text,
    "refundStatus" text,
    "hasProof" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) with time zone NOT NULL,
    "categoryId" integer
);


ALTER TABLE public."Dispute" OWNER TO postgres;

--
-- Name: Dispute_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Dispute_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Dispute_id_seq" OWNER TO postgres;

--
-- Name: Dispute_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Dispute_id_seq" OWNED BY public."Dispute".id;


--
-- Name: FAQ; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."FAQ" (
    id integer NOT NULL,
    question text NOT NULL,
    answer text NOT NULL,
    "categoryId" integer,
    category text,
    "isActive" boolean DEFAULT true,
    "sortOrder" integer DEFAULT 0,
    "createdAt" timestamp(3) with time zone DEFAULT now(),
    "updatedAt" timestamp(3) with time zone DEFAULT now()
);


ALTER TABLE public."FAQ" OWNER TO postgres;

--
-- Name: FAQ_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."FAQ_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."FAQ_id_seq" OWNER TO postgres;

--
-- Name: FAQ_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."FAQ_id_seq" OWNED BY public."FAQ".id;


--
-- Name: Helper; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Helper" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    rating double precision DEFAULT 0 NOT NULL,
    "totalRatings" integer DEFAULT 0 NOT NULL,
    "isAvailable" boolean DEFAULT false NOT NULL,
    "isOnline" boolean DEFAULT false NOT NULL,
    "onboardingStatus" public."OnboardingStatus" DEFAULT 'PENDING_KYC'::public."OnboardingStatus" NOT NULL,
    "lastActiveAt" timestamp(3) with time zone,
    "payoutEnabled" boolean DEFAULT false NOT NULL,
    "payoutSetupStatus" text DEFAULT 'NOT_STARTED'::text NOT NULL,
    "payoutRetryCount" integer DEFAULT 0 NOT NULL,
    "lastPayoutRetryAt" timestamp(3) with time zone,
    "ignoreCount" integer DEFAULT 0 NOT NULL,
    "noShowCount" integer DEFAULT 0 NOT NULL,
    "cancelCount" integer DEFAULT 0 NOT NULL,
    "penaltyCount" integer DEFAULT 0 NOT NULL,
    "strikeCount" integer DEFAULT 0 NOT NULL,
    "lastStrikeAt" timestamp(3) with time zone,
    "lastJobAssignedAt" timestamp(3) with time zone,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) with time zone NOT NULL
);


ALTER TABLE public."Helper" OWNER TO postgres;

--
-- Name: HelperAvailability; Type: TABLE; Schema: public; Owner: postgres
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
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) with time zone NOT NULL
);


ALTER TABLE public."HelperAvailability" OWNER TO postgres;

--
-- Name: HelperAvailability_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."HelperAvailability_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."HelperAvailability_id_seq" OWNER TO postgres;

--
-- Name: HelperAvailability_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."HelperAvailability_id_seq" OWNED BY public."HelperAvailability".id;


--
-- Name: HelperBank; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."HelperBank" (
    id integer NOT NULL,
    "helperId" integer NOT NULL,
    "accountName" text NOT NULL,
    "accountNumber" text NOT NULL,
    ifsc text NOT NULL,
    "bankName" text,
    "branchName" text,
    "isVerified" boolean DEFAULT false NOT NULL,
    "razorpayFundAccountId" text,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) with time zone NOT NULL
);


ALTER TABLE public."HelperBank" OWNER TO postgres;

--
-- Name: HelperBank_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."HelperBank_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."HelperBank_id_seq" OWNER TO postgres;

--
-- Name: HelperBank_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."HelperBank_id_seq" OWNED BY public."HelperBank".id;


--
-- Name: HelperKyc; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."HelperKyc" (
    id integer NOT NULL,
    "helperId" integer NOT NULL,
    "selfieUrl" text,
    "panUrl" text,
    "policeUrl" text,
    "panNumber" text,
    "isVerified" boolean DEFAULT false NOT NULL,
    "verifiedAt" timestamp(3) with time zone,
    "rejectionReason" text,
    "panNameFromApi" text,
    "nameMatchScore" double precision,
    "verificationStatus" text,
    "idfyRequestId" text,
    "idfyRawResponse" jsonb,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) with time zone NOT NULL
);


ALTER TABLE public."HelperKyc" OWNER TO postgres;

--
-- Name: HelperKyc_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."HelperKyc_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."HelperKyc_id_seq" OWNER TO postgres;

--
-- Name: HelperKyc_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."HelperKyc_id_seq" OWNED BY public."HelperKyc".id;


--
-- Name: HelperLocation; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."HelperLocation" (
    id integer NOT NULL,
    "helperId" integer NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    heading double precision,
    accuracy double precision,
    speed double precision,
    "updatedAt" timestamp(3) with time zone NOT NULL
);


ALTER TABLE public."HelperLocation" OWNER TO postgres;

--
-- Name: HelperLocation_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."HelperLocation_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."HelperLocation_id_seq" OWNER TO postgres;

--
-- Name: HelperLocation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."HelperLocation_id_seq" OWNED BY public."HelperLocation".id;


--
-- Name: HelperProfile; Type: TABLE; Schema: public; Owner: postgres
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
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) with time zone NOT NULL
);


ALTER TABLE public."HelperProfile" OWNER TO postgres;

--
-- Name: HelperProfile_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."HelperProfile_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."HelperProfile_id_seq" OWNER TO postgres;

--
-- Name: HelperProfile_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."HelperProfile_id_seq" OWNED BY public."HelperProfile".id;


--
-- Name: HelperService; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."HelperService" (
    id integer NOT NULL,
    "helperId" integer NOT NULL,
    "serviceId" integer NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."HelperService" OWNER TO postgres;

--
-- Name: HelperService_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."HelperService_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."HelperService_id_seq" OWNER TO postgres;

--
-- Name: HelperService_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."HelperService_id_seq" OWNED BY public."HelperService".id;


--
-- Name: Helper_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Helper_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Helper_id_seq" OWNER TO postgres;

--
-- Name: Helper_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Helper_id_seq" OWNED BY public."Helper".id;


--
-- Name: KiranaCategory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."KiranaCategory" (
    id integer NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    icon text DEFAULT 'Package'::text,
    image text,
    tagline text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) with time zone NOT NULL
);


ALTER TABLE public."KiranaCategory" OWNER TO postgres;

--
-- Name: KiranaCategory_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."KiranaCategory_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."KiranaCategory_id_seq" OWNER TO postgres;

--
-- Name: KiranaCategory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."KiranaCategory_id_seq" OWNED BY public."KiranaCategory".id;


--
-- Name: KiranaProduct; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."KiranaProduct" (
    id integer NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    brand text DEFAULT 'Generic'::text,
    "categoryId" integer NOT NULL,
    "sellerId" integer,
    unit text DEFAULT '1 unit'::text NOT NULL,
    pack text,
    "originalPrice" double precision NOT NULL,
    "sellingPrice" double precision NOT NULL,
    "discountPercentage" double precision DEFAULT 0 NOT NULL,
    stock integer DEFAULT 50 NOT NULL,
    "inStock" boolean DEFAULT true NOT NULL,
    image text,
    "isFeatured" boolean DEFAULT false NOT NULL,
    "isBestseller" boolean DEFAULT false NOT NULL,
    rating double precision DEFAULT 4.8 NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) with time zone NOT NULL
);


ALTER TABLE public."KiranaProduct" OWNER TO postgres;

--
-- Name: KiranaProduct_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."KiranaProduct_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."KiranaProduct_id_seq" OWNER TO postgres;

--
-- Name: KiranaProduct_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."KiranaProduct_id_seq" OWNED BY public."KiranaProduct".id;


--
-- Name: LaundryCatalogItem; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."LaundryCatalogItem" (
    id integer NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    gender text,
    icon text DEFAULT 'Shirt'::text,
    pricing jsonb NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) with time zone NOT NULL
);


ALTER TABLE public."LaundryCatalogItem" OWNER TO postgres;

--
-- Name: LaundryCatalogItem_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."LaundryCatalogItem_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."LaundryCatalogItem_id_seq" OWNER TO postgres;

--
-- Name: LaundryCatalogItem_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."LaundryCatalogItem_id_seq" OWNED BY public."LaundryCatalogItem".id;


--
-- Name: LaundryCatalogService; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."LaundryCatalogService" (
    id integer NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    icon text DEFAULT 'Sparkles'::text,
    image text,
    turnaround text DEFAULT '24-48 Hours'::text,
    tagline text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) with time zone NOT NULL
);


ALTER TABLE public."LaundryCatalogService" OWNER TO postgres;

--
-- Name: LaundryCatalogService_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."LaundryCatalogService_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."LaundryCatalogService_id_seq" OWNER TO postgres;

--
-- Name: LaundryCatalogService_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."LaundryCatalogService_id_seq" OWNED BY public."LaundryCatalogService".id;


--
-- Name: LedgerEntry; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."LedgerEntry" (
    id integer NOT NULL,
    "bookingId" integer,
    "userId" integer,
    type public."LedgerType" NOT NULL,
    direction public."LedgerDirection" NOT NULL,
    amount numeric(14,2) NOT NULL,
    "referenceId" text,
    metadata jsonb,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."LedgerEntry" OWNER TO postgres;

--
-- Name: LedgerEntry_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."LedgerEntry_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."LedgerEntry_id_seq" OWNER TO postgres;

--
-- Name: LedgerEntry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."LedgerEntry_id_seq" OWNED BY public."LedgerEntry".id;


--
-- Name: NotificationLog; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."NotificationLog" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    type text NOT NULL,
    data jsonb,
    "isRead" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."NotificationLog" OWNER TO postgres;

--
-- Name: NotificationLog_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."NotificationLog_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."NotificationLog_id_seq" OWNER TO postgres;

--
-- Name: NotificationLog_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."NotificationLog_id_seq" OWNED BY public."NotificationLog".id;


--
-- Name: Otp; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Otp" (
    id integer NOT NULL,
    phone text NOT NULL,
    purpose text NOT NULL,
    "expiresAt" timestamp(3) with time zone NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Otp" OWNER TO postgres;

--
-- Name: OtpSecurity; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."OtpSecurity" (
    id integer NOT NULL,
    phone text NOT NULL,
    "failedAttempts" integer DEFAULT 0 NOT NULL,
    "lockedUntil" timestamp(3) with time zone,
    "lastSentAt" timestamp(3) with time zone,
    "resendCount" integer DEFAULT 0 NOT NULL,
    "resendResetAt" timestamp(3) with time zone,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) with time zone NOT NULL
);


ALTER TABLE public."OtpSecurity" OWNER TO postgres;

--
-- Name: OtpSecurity_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."OtpSecurity_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."OtpSecurity_id_seq" OWNER TO postgres;

--
-- Name: OtpSecurity_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."OtpSecurity_id_seq" OWNED BY public."OtpSecurity".id;


--
-- Name: Otp_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Otp_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Otp_id_seq" OWNER TO postgres;

--
-- Name: Otp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Otp_id_seq" OWNED BY public."Otp".id;


--
-- Name: Payment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Payment" (
    id integer NOT NULL,
    "bookingId" integer NOT NULL,
    amount double precision NOT NULL,
    status public."PaymentStatus" DEFAULT 'CREATED'::public."PaymentStatus" NOT NULL,
    "transactionId" text,
    "razorpayOrderId" text,
    "razorpayPaymentId" text,
    "escrowStatus" public."EscrowStatus" DEFAULT 'PENDING'::public."EscrowStatus",
    "refundReason" text,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) with time zone NOT NULL
);


ALTER TABLE public."Payment" OWNER TO postgres;

--
-- Name: Payment_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Payment_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Payment_id_seq" OWNER TO postgres;

--
-- Name: Payment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Payment_id_seq" OWNED BY public."Payment".id;


--
-- Name: PlatformAnnouncement; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."PlatformAnnouncement" (
    id integer NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    "targetUsers" text DEFAULT 'ALL_SELLERS'::text NOT NULL,
    "categoryId" integer,
    "emailSent" boolean DEFAULT false,
    "createdAt" timestamp(3) with time zone DEFAULT now(),
    "updatedAt" timestamp(3) with time zone DEFAULT now()
);


ALTER TABLE public."PlatformAnnouncement" OWNER TO postgres;

--
-- Name: PlatformAnnouncement_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."PlatformAnnouncement_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."PlatformAnnouncement_id_seq" OWNER TO postgres;

--
-- Name: PlatformAnnouncement_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."PlatformAnnouncement_id_seq" OWNED BY public."PlatformAnnouncement".id;


--
-- Name: PlatformCategory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."PlatformCategory" (
    id integer NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    icon text DEFAULT 'Package'::text,
    image text,
    "isActive" boolean DEFAULT true,
    "sortOrder" integer DEFAULT 0,
    "createdAt" timestamp(3) with time zone DEFAULT now(),
    "updatedAt" timestamp(3) with time zone DEFAULT now()
);


ALTER TABLE public."PlatformCategory" OWNER TO postgres;

--
-- Name: PlatformCategory_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."PlatformCategory_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."PlatformCategory_id_seq" OWNER TO postgres;

--
-- Name: PlatformCategory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."PlatformCategory_id_seq" OWNED BY public."PlatformCategory".id;


--
-- Name: PlatformNotification; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."PlatformNotification" (
    id integer NOT NULL,
    "userId" integer,
    "recipientType" text DEFAULT 'SELLER'::text NOT NULL,
    "recipientEmail" text,
    title text NOT NULL,
    message text NOT NULL,
    type text DEFAULT 'GENERAL'::text NOT NULL,
    "isRead" boolean DEFAULT false,
    metadata jsonb,
    "createdAt" timestamp(3) with time zone DEFAULT now()
);


ALTER TABLE public."PlatformNotification" OWNER TO postgres;

--
-- Name: PlatformNotification_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."PlatformNotification_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."PlatformNotification_id_seq" OWNER TO postgres;

--
-- Name: PlatformNotification_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."PlatformNotification_id_seq" OWNED BY public."PlatformNotification".id;


--
-- Name: PlatformOtp; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."PlatformOtp" (
    id integer NOT NULL,
    email text NOT NULL,
    code text NOT NULL,
    purpose text NOT NULL,
    "expiresAt" timestamp(3) with time zone NOT NULL,
    "isVerified" boolean DEFAULT false,
    attempts integer DEFAULT 0,
    "createdAt" timestamp(3) with time zone DEFAULT now()
);


ALTER TABLE public."PlatformOtp" OWNER TO postgres;

--
-- Name: PlatformOtp_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."PlatformOtp_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."PlatformOtp_id_seq" OWNER TO postgres;

--
-- Name: PlatformOtp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."PlatformOtp_id_seq" OWNED BY public."PlatformOtp".id;


--
-- Name: PlatformSetting; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."PlatformSetting" (
    id integer DEFAULT 1 NOT NULL,
    "commissionRate" double precision DEFAULT 0.20 NOT NULL,
    "maxBookingHours" integer,
    "minBookingHours" integer,
    "cancellationFeePercent" double precision,
    "helperBookingGapHours" integer DEFAULT 2 NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) with time zone NOT NULL
);


ALTER TABLE public."PlatformSetting" OWNER TO postgres;

--
-- Name: Rating; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Rating" (
    id integer NOT NULL,
    "bookingId" integer NOT NULL,
    "userId" integer NOT NULL,
    "helperId" integer NOT NULL,
    rating integer NOT NULL,
    review text,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) with time zone NOT NULL
);


ALTER TABLE public."Rating" OWNER TO postgres;

--
-- Name: Rating_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Rating_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Rating_id_seq" OWNER TO postgres;

--
-- Name: Rating_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Rating_id_seq" OWNED BY public."Rating".id;


--
-- Name: RefreshToken; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."RefreshToken" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    "tokenHash" text NOT NULL,
    revoked boolean DEFAULT false NOT NULL,
    "expiresAt" timestamp(3) with time zone NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deviceId" text,
    "ipAddress" text,
    "userAgent" text
);


ALTER TABLE public."RefreshToken" OWNER TO postgres;

--
-- Name: RefreshToken_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."RefreshToken_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."RefreshToken_id_seq" OWNER TO postgres;

--
-- Name: RefreshToken_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."RefreshToken_id_seq" OWNED BY public."RefreshToken".id;


--
-- Name: Seller; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Seller" (
    id integer NOT NULL,
    "businessName" text NOT NULL,
    "ownerName" text NOT NULL,
    phone text NOT NULL,
    email text,
    address text NOT NULL,
    city text NOT NULL,
    pincode text NOT NULL,
    "businessType" text DEFAULT 'grocery'::text NOT NULL,
    description text,
    gstin text,
    pan text,
    "fssaiLicense" text,
    "documentUrl" text,
    "isVerified" boolean DEFAULT false NOT NULL,
    "verificationNotes" text,
    logo text,
    banner text,
    "openingTime" text DEFAULT '07:00 AM'::text NOT NULL,
    "closingTime" text DEFAULT '10:00 PM'::text NOT NULL,
    "deliveryRadiusKm" double precision DEFAULT 5.0 NOT NULL,
    "minOrderValue" double precision DEFAULT 99.0 NOT NULL,
    status public."SellerStatus" DEFAULT 'PENDING'::public."SellerStatus" NOT NULL,
    "rejectionReason" text,
    rating double precision DEFAULT 4.8 NOT NULL,
    "totalRatings" integer DEFAULT 12 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) with time zone NOT NULL,
    latitude double precision,
    longitude double precision,
    "dailyOrderLimit" integer DEFAULT 10,
    "ordersToday" integer DEFAULT 0,
    "lastOrderDate" timestamp(3) without time zone,
    "subscriptionPlan" text DEFAULT 'FREE'::text,
    "isPro" boolean DEFAULT false,
    "categoryId" integer,
    otp text,
    "otpExpiresAt" timestamp(3) with time zone,
    "otpAttempts" integer DEFAULT 0
);


ALTER TABLE public."Seller" OWNER TO postgres;

--
-- Name: SellerOrder; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."SellerOrder" (
    id integer NOT NULL,
    "orderNumber" text NOT NULL,
    "sellerId" integer NOT NULL,
    "customerName" text NOT NULL,
    "customerPhone" text NOT NULL,
    items jsonb NOT NULL,
    "totalAmount" double precision NOT NULL,
    status text DEFAULT 'Preparing'::text NOT NULL,
    "orderType" text DEFAULT 'Grocery'::text NOT NULL,
    "deliveryAddress" text,
    "paymentMethod" text DEFAULT 'ONLINE'::text,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) with time zone NOT NULL,
    "paymentStatus" text DEFAULT 'PENDING'::text,
    "razorpayOrderId" text,
    "razorpayPaymentId" text,
    "razorpaySignature" text,
    "customerLat" double precision,
    "customerLng" double precision,
    "storeLat" double precision,
    "storeLng" double precision,
    "dispatchRadiusKm" double precision DEFAULT 3.0,
    "assignedWorkerId" character varying(50),
    "customerEmail" text,
    "deliveryOtp" text,
    "deliveryOtpExpiresAt" timestamp(3) with time zone,
    "deliveryOtpVerified" boolean DEFAULT false,
    "deliveryOtpAttempts" integer DEFAULT 0,
    "arrivedAt" timestamp(3) with time zone,
    "categoryId" integer
);


ALTER TABLE public."SellerOrder" OWNER TO postgres;

--
-- Name: SellerOrder_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."SellerOrder_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."SellerOrder_id_seq" OWNER TO postgres;

--
-- Name: SellerOrder_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."SellerOrder_id_seq" OWNED BY public."SellerOrder".id;


--
-- Name: SellerWorker; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."SellerWorker" (
    id integer NOT NULL,
    "workerId" character varying(50) NOT NULL,
    "sellerId" integer NOT NULL,
    name character varying(255) NOT NULL,
    phone character varying(20) NOT NULL,
    role character varying(100) DEFAULT 'Delivery Partner'::character varying NOT NULL,
    passcode character varying(50) DEFAULT '1234'::character varying NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "assignedOrdersCount" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    email text,
    otp text,
    "otpExpiresAt" timestamp(3) with time zone,
    "otpAttempts" integer DEFAULT 0
);


ALTER TABLE public."SellerWorker" OWNER TO postgres;

--
-- Name: SellerWorker_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."SellerWorker_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."SellerWorker_id_seq" OWNER TO postgres;

--
-- Name: SellerWorker_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."SellerWorker_id_seq" OWNED BY public."SellerWorker".id;


--
-- Name: Seller_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Seller_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Seller_id_seq" OWNER TO postgres;

--
-- Name: Seller_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Seller_id_seq" OWNED BY public."Seller".id;


--
-- Name: Service; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Service" (
    id integer NOT NULL,
    name text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) with time zone NOT NULL,
    "imageUrl" text,
    icon text,
    description text,
    price double precision DEFAULT 0,
    "originalPrice" double precision,
    duration integer,
    category text,
    "categoryId" integer,
    "includedServices" jsonb DEFAULT '[]'::jsonb,
    "excludedServices" jsonb DEFAULT '[]'::jsonb,
    faqs jsonb DEFAULT '[]'::jsonb,
    requirements jsonb DEFAULT '[]'::jsonb,
    coverage jsonb DEFAULT '[]'::jsonb
);


ALTER TABLE public."Service" OWNER TO postgres;

--
-- Name: ServiceCategory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ServiceCategory" (
    id integer NOT NULL,
    name text NOT NULL,
    slug text,
    "imageUrl" text,
    "isActive" boolean DEFAULT true,
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now(),
    "platformCategoryId" integer
);


ALTER TABLE public."ServiceCategory" OWNER TO postgres;

--
-- Name: ServiceCategory_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."ServiceCategory_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."ServiceCategory_id_seq" OWNER TO postgres;

--
-- Name: ServiceCategory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."ServiceCategory_id_seq" OWNED BY public."ServiceCategory".id;


--
-- Name: ServiceCoverage; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ServiceCoverage" (
    id integer NOT NULL,
    "serviceId" integer NOT NULL,
    "areaId" integer NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL
);


ALTER TABLE public."ServiceCoverage" OWNER TO postgres;

--
-- Name: ServiceCoverage_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."ServiceCoverage_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."ServiceCoverage_id_seq" OWNER TO postgres;

--
-- Name: ServiceCoverage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."ServiceCoverage_id_seq" OWNED BY public."ServiceCoverage".id;


--
-- Name: ServicePlan; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ServicePlan" (
    id integer NOT NULL,
    "serviceId" integer NOT NULL,
    name text NOT NULL,
    price integer NOT NULL,
    "durationValue" integer NOT NULL,
    "durationUnit" public."DurationUnit" NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL
);


ALTER TABLE public."ServicePlan" OWNER TO postgres;

--
-- Name: ServicePlan_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."ServicePlan_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."ServicePlan_id_seq" OWNER TO postgres;

--
-- Name: ServicePlan_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."ServicePlan_id_seq" OWNED BY public."ServicePlan".id;


--
-- Name: Service_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Service_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Service_id_seq" OWNER TO postgres;

--
-- Name: Service_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Service_id_seq" OWNED BY public."Service".id;


--
-- Name: SupportTicket; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."SupportTicket" (
    id integer NOT NULL,
    "helperId" integer NOT NULL,
    "bookingId" integer,
    message text NOT NULL,
    status text DEFAULT 'OPEN'::text NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) with time zone NOT NULL
);


ALTER TABLE public."SupportTicket" OWNER TO postgres;

--
-- Name: SupportTicket_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."SupportTicket_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."SupportTicket_id_seq" OWNER TO postgres;

--
-- Name: SupportTicket_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."SupportTicket_id_seq" OWNED BY public."SupportTicket".id;


--
-- Name: User; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."User" (
    id integer NOT NULL,
    phone text NOT NULL,
    "fullName" text NOT NULL,
    avatar text,
    "isActive" boolean DEFAULT false NOT NULL,
    role public."UserRole" DEFAULT 'CUSTOMER'::public."UserRole" NOT NULL,
    "isBlocked" boolean DEFAULT false NOT NULL,
    "blockedReason" text,
    "suspendedUntil" timestamp(3) with time zone,
    address text,
    city text,
    "pinCode" text,
    latitude double precision,
    longitude double precision,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) with time zone NOT NULL,
    email text,
    password text
);


ALTER TABLE public."User" OWNER TO postgres;

--
-- Name: UserAddress; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."UserAddress" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    label text,
    address text NOT NULL,
    city text NOT NULL,
    "pinCode" text NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."UserAddress" OWNER TO postgres;

--
-- Name: UserAddress_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."UserAddress_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."UserAddress_id_seq" OWNER TO postgres;

--
-- Name: UserAddress_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."UserAddress_id_seq" OWNED BY public."UserAddress".id;


--
-- Name: User_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."User_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."User_id_seq" OWNER TO postgres;

--
-- Name: User_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."User_id_seq" OWNED BY public."User".id;


--
-- Name: pan_verification; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pan_verification (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    "panNumber" text NOT NULL,
    "panName" text NOT NULL,
    "isVerified" boolean DEFAULT false NOT NULL,
    "verificationId" text,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) with time zone NOT NULL
);


ALTER TABLE public.pan_verification OWNER TO postgres;

--
-- Name: pan_verification_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pan_verification_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pan_verification_id_seq OWNER TO postgres;

--
-- Name: pan_verification_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pan_verification_id_seq OWNED BY public.pan_verification.id;


--
-- Name: Area id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Area" ALTER COLUMN id SET DEFAULT nextval('public."Area_id_seq"'::regclass);


--
-- Name: AuthAudit id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AuthAudit" ALTER COLUMN id SET DEFAULT nextval('public."AuthAudit_id_seq"'::regclass);


--
-- Name: Booking id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Booking" ALTER COLUMN id SET DEFAULT nextval('public."Booking_id_seq"'::regclass);


--
-- Name: BookingIssue id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."BookingIssue" ALTER COLUMN id SET DEFAULT nextval('public."BookingIssue_id_seq"'::regclass);


--
-- Name: BookingRequest id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."BookingRequest" ALTER COLUMN id SET DEFAULT nextval('public."BookingRequest_id_seq"'::regclass);


--
-- Name: BookingWorkPhoto id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."BookingWorkPhoto" ALTER COLUMN id SET DEFAULT nextval('public."BookingWorkPhoto_id_seq"'::regclass);


--
-- Name: City id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."City" ALTER COLUMN id SET DEFAULT nextval('public."City_id_seq"'::regclass);


--
-- Name: Coupon id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Coupon" ALTER COLUMN id SET DEFAULT nextval('public."Coupon_id_seq"'::regclass);


--
-- Name: DeviceToken id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DeviceToken" ALTER COLUMN id SET DEFAULT nextval('public."DeviceToken_id_seq"'::regclass);


--
-- Name: Dispute id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Dispute" ALTER COLUMN id SET DEFAULT nextval('public."Dispute_id_seq"'::regclass);


--
-- Name: FAQ id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FAQ" ALTER COLUMN id SET DEFAULT nextval('public."FAQ_id_seq"'::regclass);


--
-- Name: Helper id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Helper" ALTER COLUMN id SET DEFAULT nextval('public."Helper_id_seq"'::regclass);


--
-- Name: HelperAvailability id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HelperAvailability" ALTER COLUMN id SET DEFAULT nextval('public."HelperAvailability_id_seq"'::regclass);


--
-- Name: HelperBank id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HelperBank" ALTER COLUMN id SET DEFAULT nextval('public."HelperBank_id_seq"'::regclass);


--
-- Name: HelperKyc id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HelperKyc" ALTER COLUMN id SET DEFAULT nextval('public."HelperKyc_id_seq"'::regclass);


--
-- Name: HelperLocation id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HelperLocation" ALTER COLUMN id SET DEFAULT nextval('public."HelperLocation_id_seq"'::regclass);


--
-- Name: HelperProfile id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HelperProfile" ALTER COLUMN id SET DEFAULT nextval('public."HelperProfile_id_seq"'::regclass);


--
-- Name: HelperService id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HelperService" ALTER COLUMN id SET DEFAULT nextval('public."HelperService_id_seq"'::regclass);


--
-- Name: KiranaCategory id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."KiranaCategory" ALTER COLUMN id SET DEFAULT nextval('public."KiranaCategory_id_seq"'::regclass);


--
-- Name: KiranaProduct id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."KiranaProduct" ALTER COLUMN id SET DEFAULT nextval('public."KiranaProduct_id_seq"'::regclass);


--
-- Name: LaundryCatalogItem id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LaundryCatalogItem" ALTER COLUMN id SET DEFAULT nextval('public."LaundryCatalogItem_id_seq"'::regclass);


--
-- Name: LaundryCatalogService id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LaundryCatalogService" ALTER COLUMN id SET DEFAULT nextval('public."LaundryCatalogService_id_seq"'::regclass);


--
-- Name: LedgerEntry id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LedgerEntry" ALTER COLUMN id SET DEFAULT nextval('public."LedgerEntry_id_seq"'::regclass);


--
-- Name: NotificationLog id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."NotificationLog" ALTER COLUMN id SET DEFAULT nextval('public."NotificationLog_id_seq"'::regclass);


--
-- Name: Otp id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Otp" ALTER COLUMN id SET DEFAULT nextval('public."Otp_id_seq"'::regclass);


--
-- Name: OtpSecurity id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."OtpSecurity" ALTER COLUMN id SET DEFAULT nextval('public."OtpSecurity_id_seq"'::regclass);


--
-- Name: Payment id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Payment" ALTER COLUMN id SET DEFAULT nextval('public."Payment_id_seq"'::regclass);


--
-- Name: PlatformAnnouncement id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PlatformAnnouncement" ALTER COLUMN id SET DEFAULT nextval('public."PlatformAnnouncement_id_seq"'::regclass);


--
-- Name: PlatformCategory id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PlatformCategory" ALTER COLUMN id SET DEFAULT nextval('public."PlatformCategory_id_seq"'::regclass);


--
-- Name: PlatformNotification id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PlatformNotification" ALTER COLUMN id SET DEFAULT nextval('public."PlatformNotification_id_seq"'::regclass);


--
-- Name: PlatformOtp id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PlatformOtp" ALTER COLUMN id SET DEFAULT nextval('public."PlatformOtp_id_seq"'::regclass);


--
-- Name: Rating id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Rating" ALTER COLUMN id SET DEFAULT nextval('public."Rating_id_seq"'::regclass);


--
-- Name: RefreshToken id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."RefreshToken" ALTER COLUMN id SET DEFAULT nextval('public."RefreshToken_id_seq"'::regclass);


--
-- Name: Seller id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Seller" ALTER COLUMN id SET DEFAULT nextval('public."Seller_id_seq"'::regclass);


--
-- Name: SellerOrder id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SellerOrder" ALTER COLUMN id SET DEFAULT nextval('public."SellerOrder_id_seq"'::regclass);


--
-- Name: SellerWorker id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SellerWorker" ALTER COLUMN id SET DEFAULT nextval('public."SellerWorker_id_seq"'::regclass);


--
-- Name: Service id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Service" ALTER COLUMN id SET DEFAULT nextval('public."Service_id_seq"'::regclass);


--
-- Name: ServiceCategory id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ServiceCategory" ALTER COLUMN id SET DEFAULT nextval('public."ServiceCategory_id_seq"'::regclass);


--
-- Name: ServiceCoverage id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ServiceCoverage" ALTER COLUMN id SET DEFAULT nextval('public."ServiceCoverage_id_seq"'::regclass);


--
-- Name: ServicePlan id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ServicePlan" ALTER COLUMN id SET DEFAULT nextval('public."ServicePlan_id_seq"'::regclass);


--
-- Name: SupportTicket id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SupportTicket" ALTER COLUMN id SET DEFAULT nextval('public."SupportTicket_id_seq"'::regclass);


--
-- Name: User id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User" ALTER COLUMN id SET DEFAULT nextval('public."User_id_seq"'::regclass);


--
-- Name: UserAddress id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."UserAddress" ALTER COLUMN id SET DEFAULT nextval('public."UserAddress_id_seq"'::regclass);


--
-- Name: pan_verification id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pan_verification ALTER COLUMN id SET DEFAULT nextval('public.pan_verification_id_seq'::regclass);


--
-- Data for Name: Area; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Area" (id, name, pincode, "cityId") FROM stdin;
\.


--
-- Data for Name: AuthAudit; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."AuthAudit" (id, "userId", phone, event, ip, "userAgent", "createdAt") FROM stdin;
1	\N	9999999999	OTP_SENT	::1	\N	2026-09-08 14:38:18.568+05:30
2	\N	9999999999	OTP_VERIFIED	::1	\N	2026-09-08 14:38:37.467+05:30
3	1	9999999999	LOGIN_SUCCESS	::1	\N	2026-09-08 14:38:37.492+05:30
4	\N	9999999999	OTP_SENT	::1	\N	2026-09-08 14:39:50.186+05:30
5	\N	9999999999	OTP_VERIFIED	::1	\N	2026-09-08 14:39:50.212+05:30
6	1	9999999999	LOGIN_SUCCESS	::1	\N	2026-09-08 14:39:50.229+05:30
7	\N	6350650966	OTP_SENT	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36	2026-09-08 14:42:20.215+05:30
8	\N	6350650966	OTP_SENT	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36	2026-09-08 14:44:12.259+05:30
9	\N	9999999999	OTP_VERIFIED	::1	\N	2026-09-08 14:44:26.158+05:30
10	\N	6350650966	OTP_VERIFIED	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36	2026-09-08 14:44:35.054+05:30
11	\N	6350650966	OTP_VERIFIED	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36	2026-09-08 14:44:36.928+05:30
12	\N	9999999999	OTP_VERIFIED	::1	\N	2026-09-08 14:44:47.171+05:30
13	1	9999999999	LOGIN_SUCCESS	::1	\N	2026-09-08 14:44:47.191+05:30
14	\N	9876543210	OTP_VERIFIED	::1	\N	2026-09-08 14:44:53.754+05:30
15	2	9876543210	LOGIN_SUCCESS	::1	\N	2026-09-08 14:44:53.768+05:30
16	\N	6350650966	OTP_SENT	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36	2026-09-08 14:45:26.311+05:30
17	\N	6350650966	OTP_VERIFIED	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36	2026-09-08 14:45:28.984+05:30
18	3	6350650966	LOGIN_SUCCESS	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36	2026-09-08 14:45:29+05:30
19	\N	9999999999	OTP_SENT	::1	\N	2026-09-08 14:53:44.272+05:30
20	\N	9999999999	OTP_FAILED	::1	\N	2026-09-08 14:53:44.329+05:30
21	\N	9999999999	OTP_VERIFIED	::1	\N	2026-09-08 14:53:44.354+05:30
22	1	9999999999	LOGIN_SUCCESS	::1	\N	2026-09-08 14:53:44.387+05:30
23	\N	9999999999	OTP_SENT	::1	node	2026-09-08 14:58:42.057+05:30
24	\N	9999999999	OTP_VERIFIED	::1	node	2026-09-08 14:58:42.112+05:30
25	1	9999999999	LOGIN_SUCCESS	::1	node	2026-09-08 14:58:42.141+05:30
26	\N	9999999999	OTP_SENT	::1	node	2026-09-08 14:58:48.033+05:30
27	\N	9999999999	OTP_VERIFIED	::1	node	2026-09-08 14:58:48.078+05:30
28	1	9999999999	LOGIN_SUCCESS	::1	node	2026-09-08 14:58:48.093+05:30
29	\N	9999999999	OTP_SENT	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36	2026-09-08 15:03:52.14+05:30
30	\N	9999999999	OTP_VERIFIED	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36	2026-09-08 15:04:05.317+05:30
31	1	9999999999	LOGIN_SUCCESS	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36	2026-09-08 15:04:05.38+05:30
32	\N	9999999999	OTP_SENT	::1	node	2026-09-08 16:34:52.24+05:30
33	\N	9999999999	OTP_VERIFIED	::1	node	2026-09-08 16:34:52.273+05:30
34	1	9999999999	LOGIN_SUCCESS	::1	node	2026-09-08 16:34:52.293+05:30
35	\N	9811122233	OTP_SENT	::1	node	2026-09-08 16:34:52.312+05:30
36	\N	9811122233	OTP_VERIFIED	::1	node	2026-09-08 16:34:52.326+05:30
37	8	9811122233	LOGIN_SUCCESS	::1	node	2026-09-08 16:34:52.334+05:30
38	\N	9999999999	OTP_SENT	::1	node	2026-09-08 16:36:34.071+05:30
39	\N	9999999999	OTP_VERIFIED	::1	node	2026-09-08 16:36:34.112+05:30
40	1	9999999999	LOGIN_SUCCESS	::1	node	2026-09-08 16:36:34.136+05:30
41	\N	9811122233	OTP_SENT	::1	node	2026-09-08 16:36:34.154+05:30
42	\N	9811122233	OTP_VERIFIED	::1	node	2026-09-08 16:36:34.17+05:30
43	8	9811122233	LOGIN_SUCCESS	::1	node	2026-09-08 16:36:34.178+05:30
44	\N	9999999999	OTP_SENT	::1	node	2026-09-08 17:11:30.544+05:30
45	\N	9999999999	OTP_VERIFIED	::1	node	2026-09-08 17:11:30.619+05:30
46	1	9999999999	LOGIN_SUCCESS	::1	node	2026-09-08 17:11:30.658+05:30
47	\N	9999999999	OTP_SENT	::1	node	2026-09-08 17:11:53.042+05:30
48	\N	9999999999	OTP_VERIFIED	::1	node	2026-09-08 17:11:53.138+05:30
49	1	9999999999	LOGIN_SUCCESS	::1	node	2026-09-08 17:11:53.185+05:30
50	\N	9999999999	OTP_SENT	::1	node	2026-09-08 17:11:58.647+05:30
51	\N	9999999999	OTP_VERIFIED	::1	node	2026-09-08 17:11:58.708+05:30
52	1	9999999999	LOGIN_SUCCESS	::1	node	2026-09-08 17:11:58.726+05:30
53	\N	9999999999	OTP_SENT	::1	node	2026-09-08 17:12:15.931+05:30
54	\N	9999999999	OTP_VERIFIED	::1	node	2026-09-08 17:12:15.999+05:30
55	1	9999999999	LOGIN_SUCCESS	::1	node	2026-09-08 17:12:16.029+05:30
56	\N	9999999999	OTP_SENT	::1	node	2026-09-08 17:13:04.195+05:30
57	\N	9999999999	OTP_VERIFIED	::1	node	2026-09-08 17:13:04.261+05:30
58	1	9999999999	LOGIN_SUCCESS	::1	node	2026-09-08 17:13:04.302+05:30
59	\N	9999999999	OTP_SENT	::1	node	2026-09-08 17:13:14.909+05:30
60	\N	9999999999	OTP_VERIFIED	::1	node	2026-09-08 17:13:14.934+05:30
61	1	9999999999	LOGIN_SUCCESS	::1	node	2026-09-08 17:13:14.95+05:30
62	\N	9999999999	OTP_SENT	::1	node	2026-09-08 17:13:39.316+05:30
63	\N	9999999999	OTP_VERIFIED	::1	node	2026-09-08 17:13:39.406+05:30
64	1	9999999999	LOGIN_SUCCESS	::1	node	2026-09-08 17:13:39.451+05:30
65	\N	9999999999	OTP_SENT	::1	node	2026-09-08 17:13:47.127+05:30
66	\N	9999999999	OTP_VERIFIED	::1	node	2026-09-08 17:13:47.171+05:30
67	1	9999999999	LOGIN_SUCCESS	::1	node	2026-09-08 17:13:47.188+05:30
68	\N	9999999999	OTP_SENT	::1	node	2026-09-08 17:32:55.749+05:30
\.


--
-- Data for Name: Booking; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Booking" (id, "customerId", "serviceId", "servicePlanId", "helperId", "reservedHelperId", "reservedAt", "bookingDate", "startTime", "endTime", duration, "totalHours", "paymentExpiresAt", status, location, address, city, "pinCode", latitude, longitude, notes, "specialRequirements", "startOtp", "otpGeneratedAt", "otpAttempts", "startedAt", "endedAt", "completedAt", "jobTimerStarted", "jobStartedAt", "cancelReason", "cancelledBy", "refundAmount", "refundedAt", "totalAmount", "platformFee", tax, "finalAmount", "payoutStatus", "payoutEligibleAt", "payoutId", "payoutAt", "retryCount", "lastRetryAt", "nextRetryAt", "commissionRateSnapshot", "platformCommissionAmount", "helperPayoutAmount", "bookingRequestId", "createdAt", "updatedAt") FROM stdin;
1	8	1	1	2	\N	\N	2026-09-08 12:58:11.516+05:30	\N	\N	120	\N	\N	IN_PROGRESS	C-Scheme, Jaipur	Flat 402, Royal Palms, C-Scheme, Jaipur	Jaipur	302001	\N	\N	Daily deep home cleaning and dusting.	\N	\N	\N	0	\N	\N	\N	f	\N	\N	\N	\N	\N	499	0	0	499	PENDING	\N	\N	\N	0	\N	\N	\N	\N	\N	\N	2026-09-08 14:58:11.538+05:30	2026-09-08 14:58:11.538+05:30
4	11	4	9	3	\N	\N	2026-09-07 14:58:11.516+05:30	\N	\N	240	\N	\N	COMPLETED	Mansarovar, Jaipur	Plot 108, Shipra Path, Mansarovar, Jaipur	Jaipur	302020	\N	\N	City local driving for airport pickup and office commute.	\N	\N	\N	0	\N	\N	\N	f	\N	\N	\N	\N	\N	799	0	0	799	PENDING	\N	\N	\N	0	\N	\N	\N	\N	\N	\N	2026-09-08 14:58:11.569+05:30	2026-09-08 14:58:11.569+05:30
5	8	9	20	\N	\N	\N	2026-09-10 02:58:11.516+05:30	\N	\N	45	\N	\N	PENDING_PAYMENT	Tonk Road, Jaipur	Tower A-6, Mahima Panorama, Tonk Road, Jaipur	Jaipur	302018	\N	\N	Curtains and heavy linen wash & fold.	\N	\N	\N	0	\N	\N	\N	f	\N	\N	\N	\N	\N	450	0	0	450	PENDING	\N	\N	\N	0	\N	\N	\N	\N	\N	\N	2026-09-08 14:58:11.578+05:30	2026-09-08 14:58:11.578+05:30
2	9	2	4	1	\N	\N	2026-09-08 18:58:11.516+05:30	\N	\N	90	\N	\N	CANCELLED	Malviya Nagar, Jaipur	House 54, Sector 3, Malviya Nagar, Jaipur	Jaipur	302017	\N	\N	Dinner preparation for 4 guests (North Indian Veg).	\N	\N	\N	0	\N	\N	\N	f	\N	No-show: Helper did not start booking within 30 minutes	\N	\N	\N	599	0	0	599	PENDING	\N	\N	\N	0	\N	\N	\N	\N	\N	\N	2026-09-08 14:58:11.552+05:30	2026-09-09 09:34:00.73+05:30
3	10	9	21	\N	\N	\N	2026-09-09 08:58:11.516+05:30	\N	\N	60	\N	\N	CANCELLED	Vaishali Nagar, Jaipur	B-12, Queens Road, Vaishali Nagar, Jaipur	Jaipur	302021	\N	\N	Wash & Iron pickup for 8 formal shirts and 2 blazers.	\N	\N	\N	0	\N	\N	\N	f	\N	No-show: Helper did not start booking within 30 minutes	\N	\N	\N	380	0	0	380	PENDING	\N	\N	\N	0	\N	\N	\N	\N	\N	\N	2026-09-08 14:58:11.561+05:30	2026-09-09 09:34:00.769+05:30
6	12	9	20	\N	\N	\N	2026-09-09 05:30:00+05:30	\N	\N	60	\N	\N	CANCELLED	Jaipur	Flat 302 Tonk Road Jaipur 302015	Jaipur	\N	\N	\N	Handle with care (Slot: 10:00 AM - 12:00 PM)	\N	\N	\N	0	\N	\N	\N	f	\N	No-show: Helper did not start booking within 30 minutes	\N	\N	\N	140	0	0	140	PENDING	\N	\N	\N	0	\N	\N	\N	\N	\N	\N	2026-09-08 14:59:18.53+05:30	2026-09-09 09:34:00.789+05:30
7	13	9	20	\N	\N	\N	2026-09-09 05:30:00+05:30	\N	\N	60	\N	\N	CANCELLED	Jaipur	B-12, Green Enclave Malviya Nagar Jaipur 302004	Jaipur	\N	\N	\N	Please separate dark colored shirts and use mild allergen-free detergent. (Slot: 10:00 AM - 12:00 PM (Mid-day))	\N	\N	\N	0	\N	\N	\N	f	\N	No-show: Helper did not start booking within 30 minutes	\N	\N	\N	242	0	0	242	PENDING	\N	\N	\N	0	\N	\N	\N	\N	\N	\N	2026-09-09 10:14:15.997+05:30	2026-09-09 10:16:00.522+05:30
8	13	9	20	\N	\N	\N	2026-09-12 05:30:00+05:30	\N	\N	60	\N	\N	CANCELLED	Jaipur	B-12, Green Enclave Malviya Nagar Jaipur 302004	Jaipur	\N	\N	\N	Please separate dark colored shirts and use mild allergen-free detergent. (Slot: 10:00 AM - 12:00 PM (Mid-day))	\N	\N	\N	0	\N	\N	\N	f	\N	No-show: Helper did not start booking within 30 minutes	\N	\N	\N	180	0	0	180	PENDING	\N	\N	\N	0	\N	\N	\N	\N	\N	\N	2026-09-12 09:16:17.152+05:30	2026-09-12 09:18:00.463+05:30
9	14	9	20	\N	\N	\N	2026-09-15 05:30:00+05:30	\N	\N	60	\N	\N	CONFIRMED	Jaipur	Plot 42 Gopalpura Bypass Jaipur 302015	Jaipur	\N	\N	\N	Handle delicate embroidery carefully (Slot: 05:00 PM - 07:00 PM)	\N	\N	\N	0	\N	\N	\N	f	\N	\N	\N	\N	\N	400	0	0	400	PENDING	\N	\N	\N	0	\N	\N	\N	\N	\N	\N	2026-09-12 09:26:36.118+05:30	2026-09-12 09:26:36.118+05:30
10	15	9	20	\N	\N	\N	2026-09-12 05:30:00+05:30	\N	\N	60	\N	\N	CANCELLED	302015	Gopalpura Bypass Jaipur 302015 302004	Jaipur	\N	\N	\N	Please separate dark colored shirts and use mild allergen-free detergent. (Slot: 10:00 AM - 12:00 PM (Mid-day))	\N	\N	\N	0	\N	\N	\N	f	\N	No-show: Helper did not start booking within 30 minutes	\N	\N	\N	242	0	0	242	PENDING	\N	\N	\N	0	\N	\N	\N	\N	\N	\N	2026-09-12 09:28:59.121+05:30	2026-09-12 09:32:00.378+05:30
11	15	9	20	\N	\N	\N	2026-09-12 05:30:00+05:30	\N	\N	60	\N	\N	CANCELLED	302015	Gopalpura Bypass Jaipur 302015 302004	Jaipur	\N	\N	\N	Please separate dark colored shirts and use mild allergen-free detergent. (Slot: 10:00 AM - 12:00 PM (Mid-day))	\N	\N	\N	0	\N	\N	\N	f	\N	No-show: Helper did not start booking within 30 minutes	\N	\N	\N	242	0	0	242	PENDING	\N	\N	\N	0	\N	\N	\N	\N	\N	\N	2026-09-12 09:30:43.112+05:30	2026-09-12 09:32:00.428+05:30
\.


--
-- Data for Name: BookingIssue; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."BookingIssue" (id, "bookingId", "helperId", reason, notes, resolved, "resolvedAt", "resolvedBy", "createdAt") FROM stdin;
\.


--
-- Data for Name: BookingRequest; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."BookingRequest" (id, "customerId", "bookingId", "helperId", "serviceId", "servicePlanId", address, city, "pinCode", latitude, longitude, "requestedDate", "requestedTime", "estimatedHours", description, "specialRequirements", notes, "totalAmount", status, "dispatchedHelperIds", "expiresAt", "respondedAt", "rejectionReason", "rejectedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: BookingWorkPhoto; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."BookingWorkPhoto" (id, "bookingId", "photoUrl", type, "createdAt") FROM stdin;
\.


--
-- Data for Name: City; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."City" (id, name, "createdAt") FROM stdin;
\.


--
-- Data for Name: Coupon; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Coupon" (id, code, title, description, "discountType", "discountValue", "minOrderValue", "maxDiscount", "usageLimit", "usedCount", "validFrom", "validUntil", "bgColor", "textColor", "isActive", "isFirstUserOnly", "createdAt", "updatedAt", "categoryId") FROM stdin;
3	FREESHIP	Zero Delivery Fee	Free home delivery on all weekend orders.	FLAT	49	99	49	2000	0	2026-09-08 16:34:17.113+05:30	2026-10-08 16:34:17.113+05:30	#7c3aed	#ffffff	t	f	2026-09-08 16:34:17.113+05:30	2026-09-08 16:34:17.113+05:30	\N
1	FIRST50	Flat 50% Off First Order	Get 50% discount on your first grocery or laundry booking.	PERCENT	50	199	100	500	0	2026-09-08 16:34:17.113+05:30	2026-12-07 16:34:17.113+05:30	#0B2239	#ffffff	t	t	2026-09-08 16:34:17.113+05:30	2026-09-09 09:43:52.476+05:30	2
2	WELCOME100	Flat ₹100 Off	Instant ₹100 savings on orders above ₹499.	FLAT	100	499	100	1000	0	2026-09-08 16:34:17.113+05:30	2026-11-07 16:34:17.113+05:30	#16a34a	#ffffff	t	f	2026-09-08 16:34:17.113+05:30	2026-09-09 09:43:54.225+05:30	1
\.


--
-- Data for Name: DeviceToken; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."DeviceToken" (id, "userId", token, platform, "createdAt") FROM stdin;
\.


--
-- Data for Name: Dispute; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Dispute" (id, "ticketId", "orderId", type, "reportedBy", against, issue, description, status, priority, resolution, "refundStatus", "hasProof", "createdAt", "updatedAt", "categoryId") FROM stdin;
3	DIS003	HB001	customer	Vikram Patel	Sunita Devi	Late Arrival for Cooking	Helper arrived 45 minutes late, but issue resolved mutually.	resolved	low	\N	\N	f	2026-09-08 16:34:17.122+05:30	2026-09-08 16:34:17.122+05:30	\N
1	DIS001	GL-GRC-89124	customer	Ananya Sharma	GreenFarm Organics	Missing 1 Item in Grocery Basket	Organic Spinach was not included in the bag delivered.	resolved	high	Tested resolution by automated audit	\N	t	2026-09-08 16:34:17.122+05:30	2026-09-08 16:34:52.589+05:30	\N
2	DIS002	GL-LND-2026-44101	partner	CleanWave Laundry	Kunal Singhania	Customer Not Responding on Pickup	Rider reached the gate but phone was switched off.	resolved	medium	Tested resolution by automated audit	\N	f	2026-09-08 16:34:17.122+05:30	2026-09-08 16:36:34.467+05:30	\N
\.


--
-- Data for Name: FAQ; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."FAQ" (id, question, answer, "categoryId", category, "isActive", "sortOrder", "createdAt", "updatedAt") FROM stdin;
1	How long does standard laundry and dry cleaning take?	Standard wash and fold takes 24 hours. Premium dry cleaning and steam press typically take 24 to 48 hours with doorstep pickup and delivery.	2	laundry	t	1	2026-09-14 09:08:32.083+05:30	2026-09-14 09:08:32.083+05:30
2	What detergents and processes are used for delicate garments?	We use certified hypoallergenic, eco-friendly European liquid detergents and separate all whites, darks, and delicate fabrics.	2	laundry	t	2	2026-09-14 09:08:32.089+05:30	2026-09-14 09:08:32.089+05:30
3	Is express or same-day laundry delivery available?	Yes, our Steam Press Only service offers an express 12-hour turnaround option in select pin codes.	2	laundry	t	3	2026-09-14 09:08:32.091+05:30	2026-09-14 09:08:32.091+05:30
4	What is the minimum order value for Grocery / Kirana delivery?	There is no strict minimum order value, but orders above ₹499 qualify for free express delivery.	1	grocery	t	1	2026-09-14 09:08:32.094+05:30	2026-09-14 09:08:32.094+05:30
5	How fast will my grocery order be delivered?	Local kirana and fresh items are delivered within 30 to 60 minutes directly from verified neighborhood partner stores.	1	grocery	t	2	2026-09-14 09:08:32.095+05:30	2026-09-14 09:08:32.095+05:30
6	Are home service professionals background-checked and verified?	All cooks, maids, drivers, electricians, and plumbers undergo strict 100% government ID, police, and background verification.	5	home_services	t	1	2026-09-14 09:08:32.097+05:30	2026-09-14 09:08:32.097+05:30
7	Can I reschedule or cancel a booked service?	Yes, you can cancel or reschedule your booking at zero penalty up to 2 hours before the scheduled time slot.	5	home_services	t	2	2026-09-14 09:08:32.1+05:30	2026-09-14 09:08:32.1+05:30
8	How do I reach 24/7 customer support for dispute resolution?	You can raise a support ticket directly from the Admin or Customer dashboard, or contact our helpline.	\N	general	t	1	2026-09-14 09:08:32.102+05:30	2026-09-14 09:08:32.102+05:30
\.


--
-- Data for Name: Helper; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Helper" (id, "userId", rating, "totalRatings", "isAvailable", "isOnline", "onboardingStatus", "lastActiveAt", "payoutEnabled", "payoutSetupStatus", "payoutRetryCount", "lastPayoutRetryAt", "ignoreCount", "noShowCount", "cancelCount", "penaltyCount", "strikeCount", "lastStrikeAt", "lastJobAssignedAt", "createdAt", "updatedAt") FROM stdin;
2	5	4.9	42	t	t	APPROVED	\N	f	NOT_STARTED	0	\N	0	0	0	0	0	\N	\N	2026-09-08 14:57:56.43+05:30	2026-09-08 14:57:56.43+05:30
3	6	4.75	42	t	t	APPROVED	\N	f	NOT_STARTED	0	\N	0	0	0	0	0	\N	\N	2026-09-08 14:57:56.443+05:30	2026-09-08 14:57:56.443+05:30
4	7	4.95	42	t	t	APPROVED	\N	f	NOT_STARTED	0	\N	0	0	0	0	0	\N	\N	2026-09-08 14:57:56.455+05:30	2026-09-08 14:57:56.455+05:30
1	4	4.85	42	t	t	APPROVED	\N	f	NOT_STARTED	0	\N	0	1	0	0	0	\N	\N	2026-09-08 14:57:56.403+05:30	2026-09-09 09:34:00.761+05:30
\.


--
-- Data for Name: HelperAvailability; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."HelperAvailability" (id, "helperId", monday, tuesday, wednesday, thursday, friday, saturday, sunday, "startTime", "endTime", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: HelperBank; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."HelperBank" (id, "helperId", "accountName", "accountNumber", ifsc, "bankName", "branchName", "isVerified", "razorpayFundAccountId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: HelperKyc; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."HelperKyc" (id, "helperId", "selfieUrl", "panUrl", "policeUrl", "panNumber", "isVerified", "verifiedAt", "rejectionReason", "panNameFromApi", "nameMatchScore", "verificationStatus", "idfyRequestId", "idfyRawResponse", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: HelperLocation; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."HelperLocation" (id, "helperId", latitude, longitude, heading, accuracy, speed, "updatedAt") FROM stdin;
\.


--
-- Data for Name: HelperProfile; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."HelperProfile" (id, "helperId", gender, address, city, "pinCode", latitude, longitude, "workType", "experienceYears", "createdAt", "updatedAt") FROM stdin;
1	1	\N	Malviya Nagar, Jaipur	Jaipur	\N	\N	\N	FULL_TIME	5	2026-09-08 14:57:56.403+05:30	2026-09-08 14:57:56.403+05:30
2	2	\N	Malviya Nagar, Jaipur	Jaipur	\N	\N	\N	FULL_TIME	5	2026-09-08 14:57:56.43+05:30	2026-09-08 14:57:56.43+05:30
3	3	\N	Malviya Nagar, Jaipur	Jaipur	\N	\N	\N	FULL_TIME	5	2026-09-08 14:57:56.443+05:30	2026-09-08 14:57:56.443+05:30
4	4	\N	Malviya Nagar, Jaipur	Jaipur	\N	\N	\N	FULL_TIME	5	2026-09-08 14:57:56.455+05:30	2026-09-08 14:57:56.455+05:30
\.


--
-- Data for Name: HelperService; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."HelperService" (id, "helperId", "serviceId", "createdAt") FROM stdin;
\.


--
-- Data for Name: KiranaCategory; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."KiranaCategory" (id, name, slug, icon, image, tagline, "sortOrder", "isActive", "createdAt", "updatedAt") FROM stdin;
2	Dairy & Farm Eggs	dairy-eggs	Milk	https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600&auto=format&fit=crop&q=80	Morning farm milk, paneer, and artisan butter	2	t	2026-09-08 14:17:07.335+05:30	2026-09-08 14:17:07.335+05:30
3	Artisan Bakery	bakery	Wheat	https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80	Sourdough, brioche, and morning bakes	3	t	2026-09-08 14:17:07.337+05:30	2026-09-08 14:17:07.337+05:30
4	Pantry Staples	staples	Package	https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&auto=format&fit=crop&q=80	Aged basmati, organic grains & pure cold-pressed oils	4	t	2026-09-08 14:17:07.339+05:30	2026-09-08 14:17:07.339+05:30
5	Beverages & Brews	beverages	Coffee	https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=600&auto=format&fit=crop&q=80	Estate coffee, cold pressed juices, and kombucha	5	t	2026-09-08 14:17:07.341+05:30	2026-09-08 14:17:07.341+05:30
6	Gourmet Snacks	snacks	Cookie	https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=600&auto=format&fit=crop&q=80	Roasted dry fruits, chips, and clean bites	6	t	2026-09-08 14:17:07.343+05:30	2026-09-08 14:17:07.343+05:30
7	Eco Household	household	Sparkles	https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=600&auto=format&fit=crop&q=80	Plant-based cleaning and zero-waste home care	7	t	2026-09-08 14:17:07.345+05:30	2026-09-08 14:17:07.345+05:30
8	Personal Care	personal-care	Heart	https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&auto=format&fit=crop&q=80	Gentle dermatological skin and hair essentials	8	t	2026-09-08 14:17:07.347+05:30	2026-09-08 14:17:07.347+05:30
\.


--
-- Data for Name: KiranaProduct; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."KiranaProduct" (id, name, slug, brand, "categoryId", "sellerId", unit, pack, "originalPrice", "sellingPrice", "discountPercentage", stock, "inStock", image, "isFeatured", "isBestseller", rating, "createdAt", "updatedAt") FROM stdin;
5	Artisan Malai Paneer (Block)	artisan-malai-paneer	DairyPure Creamery	2	2	250g block	\N	130	112	13	35	t	https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=700&auto=format&fit=crop&q=80	f	t	4.9	2026-09-08 14:17:07.374+05:30	2026-09-08 14:17:07.374+05:30
6	Wild Yeast Sourdough Loaf	wild-yeast-sourdough	Artisan Crust	3	1	450g loaf	\N	180	145	19	20	t	https://images.unsplash.com/photo-1509440159596-0249088772ff?w=700&auto=format&fit=crop&q=80	t	f	4.88	2026-09-08 14:17:07.377+05:30	2026-09-08 14:17:07.377+05:30
7	Cold Pressed Yellow Mustard Oil (Kachi Ghani)	mustard-oil-cold-pressed	Pure Earth	4	1	1 Litre bottle	\N	220	185	15	40	t	https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=700&auto=format&fit=crop&q=80	f	t	4.86	2026-09-08 14:17:07.379+05:30	2026-09-08 14:17:07.379+05:30
8	Roasted California Almonds & Berries Mix	roasted-almonds-berries	CleanBites	6	1	200g jar	\N	299	299	0	65	t	https://images.unsplash.com/photo-1508746829417-e6f548d8d6ed?w=700&auto=format&fit=crop&q=80	t	t	4.92	2026-09-08 14:17:07.382+05:30	2026-09-08 16:37:45.46+05:30
4	A2 Gir Cow Whole Milk (1L Glass Bottle)	a2-cow-milk	DairyPure Creamery	2	2	1 Litre	\N	1000	1000	0	50	t	https://images.unsplash.com/photo-1550583724-b2692b85b150?w=700&auto=format&fit=crop&q=80	t	t	4.95	2026-09-08 14:17:07.37+05:30	2026-09-09 10:09:35.235+05:30
12	Artisan Chocolate Croissant	artisan-chocolate-croissant-1788867827206	Royal Bakes	3	8	1 pc (120g)	\N	9090	9090	0	42	t	data:image/jpeg;base64,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	f	f	4.8	2026-09-08 17:13:47.209+05:30	2026-09-09 10:39:44.593+05:30
\.


--
-- Data for Name: LaundryCatalogItem; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."LaundryCatalogItem" (id, name, category, gender, icon, pricing, "isActive", "createdAt", "updatedAt") FROM stdin;
1	Cotton & Linen Shirt	TOPWEAR	Unisex	👔	{"dry-clean": 85, "wash-fold": 25, "wash-iron": 38, "steam-iron": 18}	t	2026-09-08 14:17:07.403+05:30	2026-09-08 14:17:07.403+05:30
2	Casual T-Shirt / Polo	TOPWEAR	Unisex	👕	{"dry-clean": 70, "wash-fold": 20, "wash-iron": 30, "steam-iron": 15}	t	2026-09-08 14:17:07.408+05:30	2026-09-08 14:17:07.408+05:30
3	Denim Jeans	BOTTOMWEAR	Unisex	👖	{"dry-clean": 110, "wash-fold": 35, "wash-iron": 48, "steam-iron": 22}	t	2026-09-08 14:17:07.41+05:30	2026-09-08 14:17:07.41+05:30
4	Formal Trouser / Chino	BOTTOMWEAR	Unisex	👖	{"dry-clean": 95, "wash-fold": 30, "wash-iron": 42, "steam-iron": 20}	t	2026-09-08 14:17:07.412+05:30	2026-09-08 14:17:07.412+05:30
5	Kurta / Ethnic Top	ETHNIC	Unisex	👘	{"dry-clean": 120, "wash-fold": 40, "wash-iron": 55, "steam-iron": 25}	t	2026-09-08 14:17:07.414+05:30	2026-09-08 14:17:07.414+05:30
6	Pure Silk / Designer Saree	ETHNIC	Women	🥻	{"dry-clean": 220, "wash-fold": 75, "wash-iron": 110, "steam-iron": 45}	t	2026-09-08 14:17:07.417+05:30	2026-09-08 14:17:07.417+05:30
7	Double Bedsheet & Pillow Covers	HOUSEHOLD	Home	🛏️	{"dry-clean": 180, "wash-fold": 70, "wash-iron": 95, "steam-iron": 40}	t	2026-09-08 14:17:07.42+05:30	2026-09-08 14:17:07.42+05:30
8	Heavy Comforter / Blanket	HOUSEHOLD	Home	🛋️	{"dry-clean": 350, "wash-fold": 160, "wash-iron": 210, "steam-iron": 80}	t	2026-09-08 14:17:07.422+05:30	2026-09-08 14:17:07.422+05:30
\.


--
-- Data for Name: LaundryCatalogService; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."LaundryCatalogService" (id, name, slug, description, icon, image, turnaround, tagline, "sortOrder", "isActive", "createdAt", "updatedAt") FROM stdin;
1	Wash & Fold	wash-fold	Everyday laundry, weighed and pristinely folded with hypoallergenic European enzymes.	Shirt	https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=700&auto=format&fit=crop&q=80	24 Hours	Separated by color, gentle tumble dry, square-corner fold	1	t	2026-09-08 14:17:07.385+05:30	2026-09-08 14:17:07.385+05:30
2	Wash & Steam Iron	wash-iron	Full wash treatment followed by crease-free steam press. Ideal for workwear & office cottons.	Sparkles	https://images.unsplash.com/photo-1489274495757-95c7c837b101?w=700&auto=format&fit=crop&q=80	24-36 Hours	Deep stain pre-spotting inspection, vacuum steam press finishing	2	t	2026-09-08 14:17:07.392+05:30	2026-09-08 14:17:07.392+05:30
3	Dry Cleaning	dry-clean	Specialized organic dry cleaning for bespoke & delicate fabrics (silks, tailored suits, ethnic wear).	Layers	https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?w=700&auto=format&fit=crop&q=80	48 Hours	Hydrocarbon eco-solvent technology, zero shrinkage guarantee	3	t	2026-09-08 14:17:07.394+05:30	2026-09-08 14:17:07.394+05:30
4	Steam Press Only	steam-iron	Professional industrial steam press for already washed garments. Sharp creases without washing.	Zap	https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=700&auto=format&fit=crop&q=80	12 Hours (Express)	High-pressure dry steam eliminates 99.9% germs with anti-shine guard	4	t	2026-09-08 14:17:07.396+05:30	2026-09-08 14:17:07.396+05:30
\.


--
-- Data for Name: LedgerEntry; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."LedgerEntry" (id, "bookingId", "userId", type, direction, amount, "referenceId", metadata, "createdAt") FROM stdin;
\.


--
-- Data for Name: NotificationLog; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."NotificationLog" (id, "userId", title, body, type, data, "isRead", "createdAt") FROM stdin;
\.


--
-- Data for Name: Otp; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Otp" (id, phone, purpose, "expiresAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: OtpSecurity; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."OtpSecurity" (id, phone, "failedAttempts", "lockedUntil", "lastSentAt", "resendCount", "resendResetAt", "createdAt", "updatedAt") FROM stdin;
11	9876543210	0	\N	\N	0	\N	2026-09-08 14:44:53.751+05:30	2026-09-08 14:44:53.751+05:30
5	6350650966	0	\N	2026-09-08 14:45:26.306+05:30	3	2026-09-08 14:42:20.211+05:30	2026-09-08 14:42:20.212+05:30	2026-09-08 14:45:28.981+05:30
24	9811122233	0	\N	2026-09-08 16:36:34.151+05:30	2	2026-09-08 16:34:52.309+05:30	2026-09-08 16:34:52.31+05:30	2026-09-08 16:36:34.168+05:30
1	9999999999	0	\N	2026-09-08 17:32:55.74+05:30	11	2026-09-08 16:34:52.233+05:30	2026-09-08 14:38:18.561+05:30	2026-09-08 17:32:55.741+05:30
\.


--
-- Data for Name: Payment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Payment" (id, "bookingId", amount, status, "transactionId", "razorpayOrderId", "razorpayPaymentId", "escrowStatus", "refundReason", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: PlatformAnnouncement; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."PlatformAnnouncement" (id, title, description, "targetUsers", "categoryId", "emailSent", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: PlatformCategory; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."PlatformCategory" (id, name, slug, description, icon, image, "isActive", "sortOrder", "createdAt", "updatedAt") FROM stdin;
1	Grocery	grocery	Fresh vegetables, daily essentials, and packaged goods	ShoppingCart	\N	t	1	2026-09-12 15:46:57.292+05:30	2026-09-12 15:46:57.292+05:30
2	Laundry	laundry	Professional wash, fold, dry clean & fabric care	Shirt	\N	t	2	2026-09-12 15:46:57.297+05:30	2026-09-12 15:46:57.297+05:30
3	Bakery	bakery	Artisan breads, fresh pastries, and custom cakes	Croissant	\N	t	3	2026-09-12 15:46:57.297+05:30	2026-09-12 15:46:57.297+05:30
4	General Store	general-store	Convenience store products and general household goods	Store	\N	t	4	2026-09-12 15:46:57.298+05:30	2026-09-12 15:46:57.298+05:30
5	Home Services	home-services	Cleaning, electrical, plumbing, and home repairs	Wrench	\N	t	5	2026-09-12 15:46:57.298+05:30	2026-09-12 15:46:57.298+05:30
\.


--
-- Data for Name: PlatformNotification; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."PlatformNotification" (id, "userId", "recipientType", "recipientEmail", title, message, type, "isRead", metadata, "createdAt") FROM stdin;
\.


--
-- Data for Name: PlatformOtp; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."PlatformOtp" (id, email, code, purpose, "expiresAt", "isVerified", attempts, "createdAt") FROM stdin;
1	seller@example.com	687359	SELLER_LOGIN	2026-09-12 16:18:10.037+05:30	f	0	2026-09-12 16:08:10.039+05:30
2	fresh.onboard@gmail.com	825534	SELLER_REGISTRATION	2026-09-12 16:18:10.086+05:30	f	0	2026-09-12 16:08:10.088+05:30
3	verify.test@gmail.com	690355	SELLER_REGISTRATION	2026-09-12 16:18:14.303+05:30	t	0	2026-09-12 16:08:14.305+05:30
4	newpartner_1789209620919@gmail.com	300121	SELLER_REGISTRATION	2026-09-12 16:20:20.923+05:30	t	0	2026-09-12 16:10:20.924+05:30
5	newpartner_1789209628526@gmail.com	925593	SELLER_REGISTRATION	2026-09-12 16:20:28.53+05:30	t	0	2026-09-12 16:10:28.531+05:30
6	newpartner_1789209628526@gmail.com	883895	SELLER_LOGIN	2026-09-12 16:20:28.56+05:30	t	0	2026-09-12 16:10:28.561+05:30
7	jofame1976@fidhost.com	674608	SELLER_REGISTRATION	2026-09-12 16:56:17.798+05:30	f	0	2026-09-12 16:46:17.799+05:30
8	wisen81567@hebase.com	388988	SELLER_REGISTRATION	2026-09-14 09:27:27.124+05:30	t	0	2026-09-14 09:17:27.127+05:30
9	wisen81567@hebase.com	796271	SELLER_LOGIN	2026-09-14 09:28:35.462+05:30	t	0	2026-09-14 09:18:35.463+05:30
10	cleanwave.owner@gmail.com	371217	SELLER_LOGIN	2026-09-14 10:21:22.171+05:30	t	0	2026-09-14 10:11:22.173+05:30
11	cleanwave.owner@gmail.com	481252	SELLER_LOGIN	2026-09-14 10:21:52.265+05:30	t	0	2026-09-14 10:11:52.267+05:30
\.


--
-- Data for Name: PlatformSetting; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."PlatformSetting" (id, "commissionRate", "maxBookingHours", "minBookingHours", "cancellationFeePercent", "helperBookingGapHours", "createdAt", "updatedAt") FROM stdin;
1	0.2	\N	\N	\N	2	2026-09-08 14:01:31.594+05:30	2026-09-08 14:01:31.594+05:30
\.


--
-- Data for Name: Rating; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Rating" (id, "bookingId", "userId", "helperId", rating, review, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: RefreshToken; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."RefreshToken" (id, "userId", "tokenHash", revoked, "expiresAt", "createdAt", "deviceId", "ipAddress", "userAgent") FROM stdin;
1	1	6a2bdf0f9fc11f5455c619fba1f61f387df6f823ffbd48d9e4c0680a441c1199	f	2026-09-15 14:38:37.482+05:30	2026-09-08 14:38:37.484+05:30	\N	::1	\N
2	1	b537ce43025790df0b9fab8042e232688138775ad6c4b731c4d703cd398c6688	f	2026-09-15 14:39:50.222+05:30	2026-09-08 14:39:50.224+05:30	\N	::1	\N
3	1	ecea11675a5f053632e5bb42437f8729bc74b2a17670290b0eb5011b00e1e75a	f	2026-09-15 14:44:47.186+05:30	2026-09-08 14:44:47.188+05:30	\N	::1	\N
4	2	ea8a1b045efe11f9f6e50d31225184cb2efdee59e3101d97bdbd34933cd30ed8	f	2026-09-15 14:44:53.764+05:30	2026-09-08 14:44:53.766+05:30	\N	::1	\N
5	3	0ba75f66af4ee12606d34e1b07ae72a059b20e3918d74de2d1ee900c05c3769b	f	2026-09-15 14:45:28.994+05:30	2026-09-08 14:45:28.996+05:30	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36
6	1	cfdc66eb2485829ab3df16c90aca5dceb81719a580a0c0dd78a51dd00b872e65	f	2026-09-15 14:53:44.377+05:30	2026-09-08 14:53:44.379+05:30	\N	::1	\N
7	1	7d5831fc22fc17869edcd7af947975e9c3bc27c61321817c7aed7a381ab8b080	f	2026-09-15 14:58:42.133+05:30	2026-09-08 14:58:42.135+05:30	\N	::1	node
8	1	197832f5101452a1ecbfb0951a9c9c05dd05178e011824fd98d971b8e16aa661	f	2026-09-15 14:58:48.089+05:30	2026-09-08 14:58:48.09+05:30	\N	::1	node
9	1	336cbd5d5414a8716e3836bf964fe73ad4a13d67e93213412e369fb045e07a66	f	2026-09-15 15:04:05.37+05:30	2026-09-08 15:04:05.372+05:30	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36
10	1	4779406320a9bd1b5f09dee03c389362b364353bc5c69f8501a6fe9ef7495a93	f	2026-09-15 16:34:52.287+05:30	2026-09-08 16:34:52.289+05:30	\N	::1	node
11	8	2b15adc83304ff183b51e0205aa0093e992ba4c2c39a99232b0f21bd1e8104c1	f	2026-09-15 16:34:52.33+05:30	2026-09-08 16:34:52.332+05:30	\N	::1	node
12	1	3819238411ae874212609ea8feef625fb096ef199f607f6a0095c13e04434f48	f	2026-09-15 16:36:34.129+05:30	2026-09-08 16:36:34.131+05:30	\N	::1	node
13	8	ab527d32a1645a0580009499b19b61fc8e58e4b49dcdd016274337526a9b1707	f	2026-09-15 16:36:34.174+05:30	2026-09-08 16:36:34.176+05:30	\N	::1	node
14	1	434069ce583fca1016d65b2f25c8607ed493245eda1612c85605bd76b6ff42ca	f	2026-09-15 17:11:30.647+05:30	2026-09-08 17:11:30.649+05:30	\N	::1	node
15	1	b05749b9c674d93bc4744890a3921fe7825c9d4211edd51caf66c6315587d357	f	2026-09-15 17:11:53.176+05:30	2026-09-08 17:11:53.178+05:30	\N	::1	node
16	1	46f94501dd34cec5e62217ba7edd7cc5af5314e496e99764f8aa2f60ad0b5b47	f	2026-09-15 17:11:58.721+05:30	2026-09-08 17:11:58.723+05:30	\N	::1	node
17	1	4f2407b167a09eb6b67cafb81c4ae6e4ba7ce2babbb80e2435ea2b3e24ac5a01	f	2026-09-15 17:12:16.02+05:30	2026-09-08 17:12:16.022+05:30	\N	::1	node
18	1	9d49b56311f38a440939b5fe54f532fdcc0b9f73243bad8d468cc5d3965244ec	f	2026-09-15 17:13:04.291+05:30	2026-09-08 17:13:04.293+05:30	\N	::1	node
19	1	adeef06ae5b4e2d023f3ee8d3c42a94134e9e6b98f74791569ff97d98c01ba86	f	2026-09-15 17:13:14.945+05:30	2026-09-08 17:13:14.947+05:30	\N	::1	node
20	1	685d81d04603736ac0da2650bd0131317ee05a9792f2e48d9cc1ddaeb35de069	f	2026-09-15 17:13:39.439+05:30	2026-09-08 17:13:39.442+05:30	\N	::1	node
21	1	486844c77ced1fcc4dd95690dbbb9bc95ef3d1a7283075044c3c2325f62c1622	f	2026-09-15 17:13:47.182+05:30	2026-09-08 17:13:47.183+05:30	\N	::1	node
\.


--
-- Data for Name: Seller; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Seller" (id, "businessName", "ownerName", phone, email, address, city, pincode, "businessType", description, gstin, pan, "fssaiLicense", "documentUrl", "isVerified", "verificationNotes", logo, banner, "openingTime", "closingTime", "deliveryRadiusKm", "minOrderValue", status, "rejectionReason", rating, "totalRatings", "isActive", "createdAt", "updatedAt", latitude, longitude, "dailyOrderLimit", "ordersToday", "lastOrderDate", "subscriptionPlan", "isPro", "categoryId", otp, "otpExpiresAt", "otpAttempts") FROM stdin;
14	Ankit Yadav	Ankit Yadav	6350650966	wisen81567@hebase.com	Near Current GPS Location, Jaipur, Rajasthan 302001	Jaipur	302020	general-store	Verified General Store store partner serving nearby residents in Jaipur.	\N	\N	\N	\N	t	Documents verified & Approved by Admin	\N	\N	08:00 AM	09:00 PM	5	99	APPROVED	\N	4.8	12	t	2026-09-14 09:18:23.997+05:30	2026-09-14 09:23:24.384+05:30	26.90567602198587	75.74302863514251	10	0	2026-09-14 03:48:23.995	FREE	f	\N	\N	\N	0
10	Sharma Bakery & Confectionery	Pallavi Choudhary	9829988111	\N	Partap Nagar, Sector 5, Mansarovar, Jaipur	Jaipur	302001	bakery	\N	\N	\N	\N	\N	t	Documents verified & Approved by Admin	\N	\N	07:00 AM	10:00 PM	5	99	APPROVED	\N	4.8	12	t	2026-09-09 10:39:54.505+05:30	2026-09-09 11:01:38.684+05:30	26.853	75.805	10	0	2026-09-09 05:09:54.504	FREE	f	3	\N	\N	0
4	Sharma Kirana Store	Ramesh Sharma	9988776655	ramesh@sharma.in	Plot 12, Tonk Road	Jaipur	302015	grocery	Traditional Kirana with all daily essentials	\N	\N	\N	\N	t	Documents verified by Admin	\N	\N	07:00 AM	10:00 PM	5	99	PENDING	\N	4.8	12	t	2026-09-08 14:19:45.976+05:30	2026-09-08 14:46:04.518+05:30	\N	\N	10	0	\N	FREE	f	1	\N	\N	0
8	Royal Bakes & Confectionery	Aditya Verma	9829988771	aditya.bakes@example.com	Plot 42, Vaishali Nagar	Jaipur	302021	grocery	Artisan bakery and gourmet treats fresh every morning.	\N	\N	\N	\N	t	Documents verified & Approved by Admin	\N	\N	07:00 AM	10:00 PM	5	99	APPROVED	\N	4.8	12	t	2026-09-08 17:13:14.856+05:30	2026-09-12 10:43:21.182+05:30	\N	\N	10	1	2026-09-09 05:09:44.586	FREE	f	1	\N	\N	0
3	CleanWave Laundry & Fabric Care	Vikramaditya Sharma	9876543212	cleanwave.owner@gmail.com	Shop 4, Tonk Road, Near Gandhinagar, Jaipur, Rajasthan 302015	Jaipur	302018	laundry	Concierge grade laundry, steam pressing, and organic dry cleaning	08CCCCC0000C1Z7	CDEFG3456H	\N	\N	t	Documents verified by Admin	https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?w=200&auto=format&fit=crop&q=80	https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=1200&auto=format&fit=crop&q=80	07:00 AM	10:00 PM	10	149	APPROVED	\N	4.9	512	t	2026-09-08 14:17:07.323+05:30	2026-09-14 10:11:52.307+05:30	26.863	75.815	10	0	2026-09-12 03:46:17.183	FREE	f	2	\N	\N	0
2	DairyPure Creamery	Surinder Singh	9876543211	surinder@dairypure.in	Dairy Colony, Phase 2	Jaipur	302017	dairy	Farm fresh A2 milk, country eggs & artisanal dairy	08BBBBB0000B1Z6	BCDEF2345G	10019011000567	\N	t	Documents verified by Admin	https://images.unsplash.com/photo-1527153857715-3908f2ae5e81?w=200&auto=format&fit=crop&q=80	https://images.unsplash.com/photo-1550583724-b2692b85b150?w=1200&auto=format&fit=crop&q=80	05:30 AM	10:30 PM	8	49	APPROVED	\N	4.95	680	t	2026-09-08 14:17:07.319+05:30	2026-09-08 14:20:12.545+05:30	\N	\N	10	0	\N	FREE	f	1	\N	\N	0
9	GreenRoots Organic Mart	Vikramaditya Sharma	9829088776	vikram@greenroots.in	Shop 14, Central Market, Malviya Nagar	Jaipur	302004	dairy	Specializing in cold-pressed oils, chemical-free pulses, and pesticide-free greenhouse greens.	08AAAAA0000A1Z5	ABCDE1234F	10019011000234	\N	f	\N	https://images.unsplash.com/photo-1542838132-92c53300491e?w=200	https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=1200	07:00 AM	10:00 PM	6	99	PENDING	\N	4.8	12	t	2026-09-09 10:37:28.404+05:30	2026-09-09 10:37:28.404+05:30	26.88039960705389	75.81641887219347	10	0	2026-09-09 05:07:28.402	FREE	f	1	\N	\N	0
5	CleanWave Laundry & Fabric Care	Vikram Choudhary	9829033333	cleanwave@laundry.test	Shop 4, Tonk Road, Near Gandhinagar, Jaipur, Rajasthan 302015	Jaipur	302015	laundry	Eco-friendly steam wash, dry cleaning, and rapid 24hr fabric rejuvenation.	\N	\N	\N	\N	t	Verified by Admin	https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?w=400	https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=1200	07:00 AM	10:00 PM	8	149	APPROVED	\N	4.9	184	t	2026-09-08 14:57:40.695+05:30	2026-09-12 09:31:18.503+05:30	26.863	75.815	10	3	2026-09-12 04:01:18.499	FREE	f	2	\N	\N	0
11	GreenRoots Kirana Supermarket	Pallavi Choudhary	9829012345	pallavi@gmail.com	Partap Nagar, Sector 5, Mansarovar, Jaipur, Rajasthan 302020, India	Jaipur	302020	grocery	Verified grocery partner serving up to 6 km in Jaipur.	\N	\N	10022011000987	\N	t	Documents verified & Approved by Admin	\N	\N	07:00 AM	10:00 PM	6	99	APPROVED	\N	4.8	12	t	2026-09-09 10:44:48.941+05:30	2026-09-09 10:59:38.299+05:30	26.853	75.805	10	0	2026-09-09 05:14:48.94	FREE	f	1	\N	\N	0
1	GreenFarm Organics	Raghav Mehra	9876543210	raghav@greenfarm.in	Sector 45, Green Valley Hub	Jaipur	302004	produce	Direct-from-farm hydroponic produce & pesticide-free greens	08AAAAA0000A1Z5	ABCDE1234F	10019011000234	\N	t	Documents verified by Admin	https://images.unsplash.com/photo-1542838132-92c53300491e?w=200&auto=format&fit=crop&q=80	https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=1200&auto=format&fit=crop&q=80	06:00 AM	11:00 PM	6	99	APPROVED	\N	4.9	420	t	2026-09-08 14:17:07.297+05:30	2026-09-12 16:03:24.479+05:30	\N	\N	10	1	2026-09-12 03:59:27.509	FREE	f	1	722125	2026-09-12 16:13:24.477+05:30	0
12	Apex Grocery Store	Apex Owner	9829099999	seller@example.com	Malviya Nagar, Jaipur, Rajasthan	Jaipur	302017	grocery	\N	\N	\N	\N	\N	t	\N	\N	\N	07:00 AM	10:00 PM	10	99	APPROVED	\N	4.8	12	t	2026-09-12 15:47:18.315+05:30	2026-09-12 16:08:10.052+05:30	\N	\N	50	0	\N	FREE	f	1	687359	2026-09-12 16:18:10.037+05:30	0
13	Green Meadows Fresh Store	Vikram Singh	9829518209	newpartner_1789209628526@gmail.com	Plot 45, Near Airport Road, Sanganer, Jaipur	Jaipur	302029	grocery	\N	\N	\N	\N	\N	f	\N	\N	\N	07:00 AM	10:00 PM	6	99	PENDING	\N	4.8	12	t	2026-09-12 16:10:28.551+05:30	2026-09-12 16:10:28.587+05:30	26.86838255743488	75.83494916107902	10	0	2026-09-12 10:40:28.549	FREE	f	\N	\N	\N	0
\.


--
-- Data for Name: SellerOrder; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."SellerOrder" (id, "orderNumber", "sellerId", "customerName", "customerPhone", items, "totalAmount", status, "orderType", "deliveryAddress", "paymentMethod", "createdAt", "updatedAt", "paymentStatus", "razorpayOrderId", "razorpayPaymentId", "razorpaySignature", "customerLat", "customerLng", "storeLat", "storeLng", "dispatchRadiusKm", "assignedWorkerId", "customerEmail", "deliveryOtp", "deliveryOtpExpiresAt", "deliveryOtpVerified", "deliveryOtpAttempts", "arrivedAt", "categoryId") FROM stdin;
12	GL-GRC-584571-1939	8	Ankit Kumar	9829012345	[{"id": "prod-12", "qty": 2, "name": "Fresh Milk", "price": 60}]	0	Preparing	Grocery	Flat 302, Royal Palms Sector 5, Mansarovar Jaipur	ONLINE	2026-09-09 10:39:44.572+05:30	2026-09-09 10:39:44.59+05:30	PENDING	\N	\N	\N	26.853	75.805	26.853	75.805	9	\N	\N	\N	\N	f	0	\N	1
7	GL-GRC-758428-2607	1	Test Buyer	9829012345	[{"id": "prod-1", "qty": 2, "name": "Organic Tomatoes", "price": 45}]	90	Out for Delivery	Grocery	House 1, Malviya Nagar, Jaipur	ONLINE	2026-09-08 14:59:18.433+05:30	2026-09-08 14:59:18.575+05:30	PENDING	\N	\N	\N	\N	\N	\N	\N	3	\N	\N	\N	\N	f	0	\N	1
10	GL-GRC-2026-377678	8	Rahul Mehra	9829123456	[{"id": 12, "_id": "prod-12", "mrp": 150, "qty": 1, "name": "Artisan Chocolate Croissant", "slug": "artisan-chocolate-croissant-1788867827206", "brand": "Royal Bakes", "image": "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600", "stock": 45, "rating": 4.8, "sellerId": "store-8", "sellerName": "Royal Bakes & Confectionery", "description": "Artisan Chocolate Croissant - Fresh, premium quality direct from verified farm/store partners.", "ratingCount": 85, "categoryName": "Artisan Bakery", "categorySlug": "bakery", "isBestseller": false, "sellingPrice": 120, "isHeroFeatured": false, "weightQuantity": "1 pc (120g)", "deliveryEstimate": "15 mins", "discountPercentage": 20}]	151	Out for Delivery	Grocery	Apt 4B Rosewood Heights, C-Scheme Jaipur 302001	ONLINE	2026-09-08 17:20:56.836+05:30	2026-09-08 17:21:45.547+05:30	PENDING	\N	\N	\N	\N	\N	\N	\N	3	\N	\N	\N	\N	f	0	\N	1
9	GL-GRC-2026-337693	8	Rahul Mehra	9829123456	[{"_id": "prod-12", "qty": 2, "name": "Artisan Chocolate Croissant", "image": "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600", "sellingPrice": 120}]	240	Delivered	Grocery	Apt 4B Rosewood Heights, C-Scheme Jaipur 302001	ONLINE	2026-09-08 17:13:55.311+05:30	2026-09-08 17:14:08.721+05:30	PENDING	\N	\N	\N	\N	\N	\N	\N	3	\N	\N	\N	\N	f	0	\N	1
11	GL-LND-22421	3	Ramesh Kumar	9829012345	[{"id": "item-shirt", "qty": 2, "icon": "👔", "name": "Cotton & Linen Shirt", "rate": 38, "lineTotal": 76}, {"id": "item-tshirt", "qty": 2, "icon": "👕", "name": "Casual T-Shirt / Polo", "rate": 30, "lineTotal": 60}, {"id": "item-jeans", "qty": 1, "icon": "👖", "name": "Denim Jeans", "rate": 48, "lineTotal": 48}]	242	Pickup Scheduled	Laundry	B-12, Green Enclave Malviya Nagar Jaipur 302004	pay_on_pickup	2026-09-09 10:14:16.011+05:30	2026-09-09 10:14:16.011+05:30	PENDING	\N	\N	\N	\N	\N	\N	\N	3	\N	\N	\N	\N	f	0	\N	2
15	GL-LND-39408	1	9829011223	42	[{"id": "item-shirt", "qty": 2, "icon": "👔", "name": "Cotton & Linen Shirt", "rate": 38, "lineTotal": 76}, {"id": "item-tshirt", "qty": 2, "icon": "👕", "name": "Casual T-Shirt / Polo", "rate": 30, "lineTotal": 60}, {"id": "item-jeans", "qty": 1, "icon": "👖", "name": "Denim Jeans", "rate": 48, "lineTotal": 48}]	242	Pickup Scheduled	Laundry	Gopalpura Bypass Jaipur 302015 302004	pay_on_pickup	2026-09-12 09:28:59.184+05:30	2026-09-12 09:29:27.528+05:30	PENDING	\N	\N	\N	26.853	75.805	26.863	75.815	3	\N	\N	\N	\N	f	0	\N	1
2	GL-GRC-2026-89125	1	Rahul Verma	+91 98222 33344	[{"qty": 1, "name": "Himalayan Garlic Bulb", "price": 90}, {"qty": 2, "name": "Farm Fresh Coriander", "price": 20}]	130	Preparing	Grocery	House 54, Sector 3, Malviya Nagar, Jaipur	COD	2026-09-08 14:58:11.61+05:30	2026-09-09 11:10:03.051+05:30	PENDING	\N	\N	\N	\N	\N	\N	\N	3	\N	\N	\N	\N	f	0	\N	1
1	GL-GRC-2026-89124	1	Ananya Sharma	+91 98111 22233	[{"qty": 2, "name": "Hydroponic Vine Tomatoes", "price": 45}, {"qty": 1, "name": "Organic Spinach Bundle", "price": 35}, {"qty": 1, "name": "Shimla Crisp Apples (1kg)", "price": 160}]	285	Preparing	Grocery	Flat 402, Royal Palms, C-Scheme, Jaipur	ONLINE	2026-09-08 14:58:11.6+05:30	2026-09-09 11:10:00.195+05:30	PENDING	\N	\N	\N	\N	\N	\N	\N	3	\N	\N	\N	\N	f	0	\N	1
4	GL-GRC-2026-89127	2	Manish Gupta	+91 98444 55566	[{"qty": 2, "name": "Farm Fresh Organic Eggs (6 pack)", "price": 75}, {"qty": 1, "name": "Country Butter Block 250g", "price": 120}]	270	Delivered	Dairy	Plot 108, Shipra Path, Mansarovar, Jaipur	ONLINE	2026-09-08 14:58:11.62+05:30	2026-09-08 14:58:11.62+05:30	PENDING	\N	\N	\N	\N	\N	\N	\N	3	\N	\N	\N	\N	f	0	\N	1
3	GL-GRC-2026-89126	2	Pooja Kashyap	+91 98333 44455	[{"qty": 2, "name": "Fresh A2 Cow Milk 1L", "price": 80}, {"qty": 1, "name": "Artisanal Malai Paneer 200g", "price": 95}]	255	Preparing	Dairy	B-12, Queens Road, Vaishali Nagar, Jaipur	ONLINE	2026-09-08 14:58:11.615+05:30	2026-09-08 14:58:11.615+05:30	PENDING	\N	\N	\N	\N	\N	\N	\N	3	\N	\N	\N	\N	f	0	\N	1
16	GL-LND-85730	5	9829011223	42	[{"id": "item-shirt", "qty": 2, "icon": "👔", "name": "Cotton & Linen Shirt", "rate": 38, "lineTotal": 76}, {"id": "item-tshirt", "qty": 2, "icon": "👕", "name": "Casual T-Shirt / Polo", "rate": 30, "lineTotal": 60}, {"id": "item-jeans", "qty": 1, "icon": "👖", "name": "Denim Jeans", "rate": 48, "lineTotal": 48}]	242	Pickup Scheduled	Laundry	Gopalpura Bypass Jaipur 302015 302004	pay_on_pickup	2026-09-12 09:30:43.132+05:30	2026-09-12 09:31:18.513+05:30	PENDING	\N	\N	\N	26.853	75.805	26.863	75.815	3	\N	\N	\N	\N	f	0	\N	2
14	GL-LND-9-8053	5	Ankit Sharma	9829011223	[{"qty": 2, "name": "Silk Kurta Delicate Wash", "price": 200}]	400	Pickup Scheduled	Laundry	Plot 42 Gopalpura Bypass Jaipur 302015	ONLINE	2026-09-12 09:26:36.154+05:30	2026-09-12 09:26:36.226+05:30	PENDING	\N	\N	\N	26.853	75.805	26.863	75.815	3	\N	\N	\N	\N	f	0	\N	2
13	GL-LND-37875	5	Ramesh Kumar	9829012345	[{"id": "item-shirt", "qty": 2, "icon": "👔", "name": "Cotton & Linen Shirt", "rate": 25, "lineTotal": 50}, {"id": "item-tshirt", "qty": 2, "icon": "👕", "name": "Casual T-Shirt / Polo", "rate": 20, "lineTotal": 40}, {"id": "item-jeans", "qty": 1, "icon": "👖", "name": "Denim Jeans", "rate": 35, "lineTotal": 35}]	180	Preparing	Laundry	B-12, Green Enclave Malviya Nagar Jaipur 302004	pay_on_pickup	2026-09-12 09:16:17.187+05:30	2026-09-12 09:16:17.207+05:30	PENDING	\N	\N	\N	26.853	75.805	26.853	75.805	3	\N	\N	\N	\N	f	0	\N	2
8	GL-LND-6-9310	5	Test Laundry Customer	9829099887	[{"qty": 4, "name": "Shirts", "rate": 35, "lineTotal": 140}]	140	Pickup Scheduled	Laundry	Flat 302 Tonk Road Jaipur 302015	ONLINE	2026-09-08 14:59:18.546+05:30	2026-09-08 14:59:18.546+05:30	PENDING	\N	\N	\N	\N	\N	\N	\N	3	\N	\N	\N	\N	f	0	\N	2
6	GL-LND-2026-44102	5	Divya Rastogi	+91 99280 77665	[{"qty": 2, "name": "Silk Saree Delicate Care", "price": 180}]	360	Ready for Dispatch	Laundry	104 Landmark Tower, Malviya Nagar, Jaipur	COD	2026-09-08 14:58:11.629+05:30	2026-09-08 14:58:11.629+05:30	PENDING	\N	\N	\N	\N	\N	\N	\N	3	\N	\N	\N	\N	f	0	\N	2
5	GL-LND-2026-44101	5	Kunal Singhania	+91 97840 99881	[{"qty": 6, "name": "Wash & Steam Iron (6 shirts)", "price": 35}, {"qty": 1, "name": "Dry Clean Suit (2 pcs)", "price": 250}]	460	In Wash Cycle	Laundry	Villa 18, Oasis Enclave, Tonk Road, Jaipur	ONLINE	2026-09-08 14:58:11.625+05:30	2026-09-08 14:58:11.625+05:30	PENDING	\N	\N	\N	\N	\N	\N	\N	3	\N	\N	\N	\N	f	0	\N	2
17	ORD-TEST-9001	12	Aman Sharma	9829012345	[{"qty": 1, "name": "Organic Atta 5kg", "price": 280}, {"qty": 1, "name": "Pure Cow Ghee 1L", "price": 650}]	930	Completed	Grocery	Flat 402, Royal Palms, C-Scheme, Jaipur	COD	2026-09-12 15:58:39.385+05:30	2026-09-12 15:58:39.521+05:30	PAID	\N	\N	\N	\N	\N	\N	\N	3	WRK-GRC-101	aman.customer@gmail.com	\N	2026-09-12 16:13:39.481+05:30	t	0	2026-09-12 15:58:39.481+05:30	\N
\.


--
-- Data for Name: SellerWorker; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."SellerWorker" (id, "workerId", "sellerId", name, phone, role, passcode, "isActive", "assignedOrdersCount", "createdAt", "updatedAt", email, otp, "otpExpiresAt", "otpAttempts") FROM stdin;
2	WRK-LAU-769	5	Suresh Verma	9829055555	Delivery Partner	7504	t	0	2026-09-12 13:12:06.184+05:30	2026-09-12 13:12:06.184+05:30	\N	\N	\N	0
3	WRK-GRC-101	12	Ravi Verma	9829088888	Delivery Executive	1234	t	0	2026-09-12 15:47:27.751+05:30	2026-09-12 15:58:39.467+05:30	worker@example.com	\N	\N	0
1	WRK-CLN-101	5	Ramesh Kumar (Delivery)	9829044444	Delivery Specialist	1234	t	0	2026-09-12 12:02:48.418+05:30	2026-09-14 10:10:21.276+05:30	worker_1789360820595@example.com	\N	\N	0
4	WRK-LAU-939	3	Agent Prakash 1018	9716826148	Delivery Executive	8093	t	0	2026-09-14 10:11:22.29+05:30	2026-09-14 10:11:22.332+05:30	worker_1789360881018@example.com	\N	\N	0
\.


--
-- Data for Name: Service; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Service" (id, name, "isActive", "createdAt", "updatedAt", "imageUrl", icon, description, price, "originalPrice", duration, category, "categoryId", "includedServices", "excludedServices", faqs, requirements, coverage) FROM stdin;
2	Cook	t	2026-09-08 14:01:31.633+05:30	2026-09-08 14:01:31.633+05:30	\N	\N	\N	0	\N	\N	Cook	2	[]	[]	[]	[]	[]
4	Driver	t	2026-09-08 14:01:31.649+05:30	2026-09-08 14:01:31.649+05:30	\N	\N	\N	0	\N	\N	Driver	4	[]	[]	[]	[]	[]
12	Electrician Quick Fix	t	2026-09-08 17:11:58.745+05:30	2026-09-08 17:11:58.745+05:30	https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600	https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600	Fan repair, wiring, and switchboard replacement.	299	\N	\N	Electrician	6	[]	[]	[]	[]	[]
13	Electrician Quick Fix	t	2026-09-08 17:12:16.049+05:30	2026-09-08 17:12:16.049+05:30	https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600	https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600	Fan repair, wiring, and switchboard replacement.	299	\N	\N	Electrician	6	[]	[]	[]	[]	[]
14	Electrician Quick Fix 2	t	2026-09-08 17:13:04.328+05:30	2026-09-08 17:13:04.328+05:30	https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600	https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600	Fan repair, wiring, and switchboard replacement.	299	\N	\N	Electrician	6	[]	[]	[]	[]	[]
1	Maid	t	2026-09-08 14:01:31.616+05:30	2026-09-08 16:36:34.38+05:30	\N	\N	\N	0	\N	\N	Maid	1	[]	[]	[]	[]	[]
9	Laundry & Dry Cleaning	t	2026-09-08 14:57:40.735+05:30	2026-09-08 14:57:40.735+05:30	\N	\N	\N	0	\N	\N	Laundry	2	[]	[]	[]	[]	[]
17	Milk	t	2026-09-09 09:55:01.272+05:30	2026-09-09 09:55:01.272+05:30	data:image/jpeg;base64,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	data:image/jpeg;base64,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	\N	35	12680	\N	Grocery	1	[]	[]	[]	[]	[]
3	Shop Helper / Salesman	t	2026-09-08 14:01:31.644+05:30	2026-09-08 14:01:31.644+05:30	\N	\N	\N	0	\N	\N	Home Services	5	[]	[]	[]	[]	[]
6	Elder Care	t	2026-09-08 14:01:31.663+05:30	2026-09-08 14:01:31.663+05:30	\N	\N	\N	0	\N	\N	Home Services	5	[]	[]	[]	[]	[]
7	Baby Sitter	t	2026-09-08 14:01:31.669+05:30	2026-09-08 14:01:31.669+05:30	\N	\N	\N	0	\N	\N	Home Services	5	[]	[]	[]	[]	[]
8	Patient Care	t	2026-09-08 14:01:31.675+05:30	2026-09-08 14:01:31.675+05:30	\N	\N	\N	0	\N	\N	Home Services	5	[]	[]	[]	[]	[]
10	Deep Home Cleaning	t	2026-09-08 17:11:30.688+05:30	2026-09-08 17:11:30.688+05:30	https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600	https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600	Professional sanitization and deep home cleaning.	1499	\N	\N	Home Services	5	[]	[]	[]	[]	[]
11	Deep Home Cleaning	t	2026-09-08 17:11:53.207+05:30	2026-09-08 17:11:53.207+05:30	https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600	https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600	Professional sanitization and deep home cleaning.	1499	\N	\N	Home Services	5	[]	[]	[]	[]	[]
15	AC Jet Cleaning & Repair	t	2026-09-08 17:16:47.505+05:30	2026-09-08 17:16:47.505+05:30	https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600	https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600	Deep AC jet cleaning, coil washing, and cooling performance check.	499	\N	\N	Home Services	5	[]	[]	[]	[]	[]
5	Nanny	t	2026-09-08 14:01:31.657+05:30	2026-09-09 09:55:37.795+05:30	data:image/jpeg;base64,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	data:image/jpeg;base64,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	\N	90000	\N	\N	Home Services	5	null	null	null	null	[]
\.


--
-- Data for Name: ServiceCategory; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ServiceCategory" (id, name, slug, "imageUrl", "isActive", "createdAt", "updatedAt", "platformCategoryId") FROM stdin;
2	Cook	cook	https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=600&q=80	t	2026-09-09 09:49:48.623065+05:30	2026-09-09 09:49:48.623065+05:30	5
4	Driver	driver	https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=600&q=80	t	2026-09-09 09:49:48.625403+05:30	2026-09-09 09:49:48.625403+05:30	5
5	Babysitter	babysitter	https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?auto=format&fit=crop&w=600&q=80	t	2026-09-09 09:49:48.626671+05:30	2026-09-09 09:49:48.626671+05:30	5
6	Electrician	electrician	https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=600&q=80	t	2026-09-09 09:49:48.627728+05:30	2026-09-09 09:49:48.627728+05:30	5
7	Plumber	plumber	https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=600&q=80	t	2026-09-09 09:49:48.628831+05:30	2026-09-09 09:49:48.628831+05:30	5
8	Carpenter	carpenter	https://images.unsplash.com/photo-1538688525198-9b88f6f53126?auto=format&fit=crop&w=600&q=80	t	2026-09-09 09:49:48.629772+05:30	2026-09-09 09:49:48.629772+05:30	5
1	Maid	maid	data:image/jpeg;base64,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	t	2026-09-09 09:49:48.619829+05:30	2026-09-09 09:51:31.312403+05:30	5
\.


--
-- Data for Name: ServiceCoverage; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ServiceCoverage" (id, "serviceId", "areaId", "isActive") FROM stdin;
\.


--
-- Data for Name: ServicePlan; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ServicePlan" (id, "serviceId", name, price, "durationValue", "durationUnit", "sortOrder", "isActive") FROM stdin;
1	1	Hourly	15000	2	HOUR	1	t
2	1	Per Day	80000	1	DAY	2	t
3	1	Monthly	300000	1	MONTH	3	t
4	2	Hourly	30000	1	HOUR	1	t
5	2	Per Day	90000	1	DAY	2	t
6	2	Monthly	350000	1	MONTH	3	t
7	3	Per Day	80000	1	DAY	1	t
8	3	Monthly	1500000	1	MONTH	2	t
9	4	Hourly	25000	1	HOUR	1	t
10	4	Per Day	120000	1	DAY	2	t
11	4	Monthly	1800000	1	MONTH	3	t
14	6	12-Hour Shift	140000	12	HOUR	1	t
15	6	Monthly	2500000	1	MONTH	2	t
16	7	Hourly	20000	1	HOUR	1	t
17	7	Per Day	100000	1	DAY	2	t
18	8	12-Hour Shift	150000	12	HOUR	1	t
19	8	Monthly	2800000	1	MONTH	2	t
20	9	Wash & Fold	99	24	HOUR	1	t
21	9	Wash & Iron	149	24	HOUR	2	t
22	9	Premium Dry Clean	299	48	HOUR	3	t
23	9	Express Steam Press	79	6	HOUR	4	t
24	13	Inspection & Minor Fix	299	1	HOUR	1	t
25	14	Inspection & Minor Fix	299	1	HOUR	1	t
26	15	Standard Jet Wash	499	1	HOUR	1	t
28	17	Standard Plan	35	1	HOUR	1	t
29	5	Plan 1	90000	1	HOUR	1	t
30	5	Plan 2	1800000	1	HOUR	2	t
\.


--
-- Data for Name: SupportTicket; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."SupportTicket" (id, "helperId", "bookingId", message, status, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."User" (id, phone, "fullName", avatar, "isActive", role, "isBlocked", "blockedReason", "suspendedUntil", address, city, "pinCode", latitude, longitude, "createdAt", "updatedAt", email, password) FROM stdin;
4	9829011111	Rajesh Sharma	\N	t	HELPER	f	\N	\N	\N	\N	\N	\N	\N	2026-09-08 14:57:56.384+05:30	2026-09-08 14:57:56.384+05:30	\N	\N
5	9829022222	Sunita Devi	\N	t	HELPER	f	\N	\N	\N	\N	\N	\N	\N	2026-09-08 14:57:56.425+05:30	2026-09-08 14:57:56.425+05:30	\N	\N
6	9829044444	Amit Verma	\N	t	HELPER	f	\N	\N	\N	\N	\N	\N	\N	2026-09-08 14:57:56.438+05:30	2026-09-08 14:57:56.438+05:30	\N	\N
7	9829055555	Kavita Meena	\N	t	HELPER	f	\N	\N	\N	\N	\N	\N	\N	2026-09-08 14:57:56.451+05:30	2026-09-08 14:57:56.451+05:30	\N	\N
8	9811122233	Ananya Sharma	\N	t	CUSTOMER	f	\N	\N	\N	\N	\N	\N	\N	2026-09-08 14:57:56.463+05:30	2026-09-08 14:57:56.463+05:30	\N	\N
9	9822233344	Vikram Patel	\N	t	CUSTOMER	f	\N	\N	\N	\N	\N	\N	\N	2026-09-08 14:57:56.468+05:30	2026-09-08 14:57:56.468+05:30	\N	\N
10	9833344455	Pooja Verma	\N	t	CUSTOMER	f	\N	\N	\N	\N	\N	\N	\N	2026-09-08 14:57:56.472+05:30	2026-09-08 14:57:56.472+05:30	\N	\N
11	9844455566	Rajesh Singhal	\N	t	CUSTOMER	f	\N	\N	\N	\N	\N	\N	\N	2026-09-08 14:57:56.476+05:30	2026-09-08 14:57:56.476+05:30	\N	\N
2	9876543210	Admin User	\N	t	CUSTOMER	f	\N	\N	\N	\N	\N	\N	\N	2026-09-08 14:44:53.758+05:30	2026-09-08 16:30:44.641+05:30	\N	\N
3	6350650966	Admin User	\N	t	CUSTOMER	f	\N	\N	\N	\N	\N	\N	\N	2026-09-08 14:45:28.989+05:30	2026-09-08 16:30:44.641+05:30	\N	\N
13	9829012345	Ramesh Kumar	\N	t	CUSTOMER	f	\N	\N	\N	\N	\N	\N	\N	2026-09-09 10:14:15.98+05:30	2026-09-09 10:14:15.98+05:30	\N	\N
15	42	9829011223	\N	t	CUSTOMER	f	\N	\N	\N	\N	\N	\N	\N	2026-09-12 09:28:59.083+05:30	2026-09-12 09:28:59.083+05:30	\N	\N
1	9999999999	Super Admin	\N	t	ADMIN	f	\N	\N	\N	\N	\N	\N	\N	2026-09-08 14:37:13.237+05:30	2026-09-08 16:30:44.619+05:30	admin@gmail.com	$2a$10$PLeZOsuzkHF4Sf9osbMAlO53TPILHkqRuGu20fKK/OfN6tU40fFqi
12	9829099887	Aarav Sharma	\N	t	CUSTOMER	f	\N	\N	\N	\N	\N	\N	\N	2026-09-08 14:59:18.512+05:30	2026-09-14 10:04:33.2+05:30	aarav.sharma@example.com	\N
14	9829011223	Vikramaditya Rathore	\N	t	CUSTOMER	f	\N	\N	\N	\N	\N	\N	\N	2026-09-12 09:26:36.089+05:30	2026-09-14 10:04:42.548+05:30	vikram.rathore@example.com	\N
16	9839072732	Verified Customer 1018	\N	t	CUSTOMER	f	\N	\N	\N	\N	\N	\N	\N	2026-09-14 10:11:21.497+05:30	2026-09-14 10:11:21.497+05:30	real_customer_1789360881018@example.com	\N
\.


--
-- Data for Name: UserAddress; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."UserAddress" (id, "userId", label, address, city, "pinCode", latitude, longitude, "isDefault", "createdAt") FROM stdin;
\.


--
-- Data for Name: pan_verification; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pan_verification (id, "userId", "panNumber", "panName", "isVerified", "verificationId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Name: Area_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Area_id_seq"', 1, false);


--
-- Name: AuthAudit_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."AuthAudit_id_seq"', 68, true);


--
-- Name: BookingIssue_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."BookingIssue_id_seq"', 1, false);


--
-- Name: BookingRequest_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."BookingRequest_id_seq"', 1, false);


--
-- Name: BookingWorkPhoto_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."BookingWorkPhoto_id_seq"', 1, false);


--
-- Name: Booking_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Booking_id_seq"', 11, true);


--
-- Name: City_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."City_id_seq"', 1, false);


--
-- Name: Coupon_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Coupon_id_seq"', 4, true);


--
-- Name: DeviceToken_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."DeviceToken_id_seq"', 1, false);


--
-- Name: Dispute_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Dispute_id_seq"', 3, true);


--
-- Name: FAQ_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."FAQ_id_seq"', 8, true);


--
-- Name: HelperAvailability_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."HelperAvailability_id_seq"', 1, false);


--
-- Name: HelperBank_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."HelperBank_id_seq"', 1, false);


--
-- Name: HelperKyc_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."HelperKyc_id_seq"', 1, false);


--
-- Name: HelperLocation_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."HelperLocation_id_seq"', 1, false);


--
-- Name: HelperProfile_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."HelperProfile_id_seq"', 4, true);


--
-- Name: HelperService_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."HelperService_id_seq"', 1, false);


--
-- Name: Helper_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Helper_id_seq"', 4, true);


--
-- Name: KiranaCategory_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."KiranaCategory_id_seq"', 8, true);


--
-- Name: KiranaProduct_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."KiranaProduct_id_seq"', 15, true);


--
-- Name: LaundryCatalogItem_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."LaundryCatalogItem_id_seq"', 8, true);


--
-- Name: LaundryCatalogService_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."LaundryCatalogService_id_seq"', 4, true);


--
-- Name: LedgerEntry_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."LedgerEntry_id_seq"', 1, false);


--
-- Name: NotificationLog_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."NotificationLog_id_seq"', 1, false);


--
-- Name: OtpSecurity_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."OtpSecurity_id_seq"', 46, true);


--
-- Name: Otp_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Otp_id_seq"', 1, false);


--
-- Name: Payment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Payment_id_seq"', 1, false);


--
-- Name: PlatformAnnouncement_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."PlatformAnnouncement_id_seq"', 1, false);


--
-- Name: PlatformCategory_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."PlatformCategory_id_seq"', 16, true);


--
-- Name: PlatformNotification_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."PlatformNotification_id_seq"', 1, false);


--
-- Name: PlatformOtp_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."PlatformOtp_id_seq"', 11, true);


--
-- Name: Rating_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Rating_id_seq"', 1, false);


--
-- Name: RefreshToken_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."RefreshToken_id_seq"', 21, true);


--
-- Name: SellerOrder_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."SellerOrder_id_seq"', 18, true);


--
-- Name: SellerWorker_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."SellerWorker_id_seq"', 5, true);


--
-- Name: Seller_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Seller_id_seq"', 14, true);


--
-- Name: ServiceCategory_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."ServiceCategory_id_seq"', 9, true);


--
-- Name: ServiceCoverage_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."ServiceCoverage_id_seq"', 1, false);


--
-- Name: ServicePlan_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."ServicePlan_id_seq"', 30, true);


--
-- Name: Service_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Service_id_seq"', 17, true);


--
-- Name: SupportTicket_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."SupportTicket_id_seq"', 1, false);


--
-- Name: UserAddress_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."UserAddress_id_seq"', 1, false);


--
-- Name: User_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."User_id_seq"', 17, true);


--
-- Name: pan_verification_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.pan_verification_id_seq', 1, false);


--
-- Name: Area Area_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Area"
    ADD CONSTRAINT "Area_pkey" PRIMARY KEY (id);


--
-- Name: AuthAudit AuthAudit_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AuthAudit"
    ADD CONSTRAINT "AuthAudit_pkey" PRIMARY KEY (id);


--
-- Name: BookingIssue BookingIssue_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."BookingIssue"
    ADD CONSTRAINT "BookingIssue_pkey" PRIMARY KEY (id);


--
-- Name: BookingRequest BookingRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."BookingRequest"
    ADD CONSTRAINT "BookingRequest_pkey" PRIMARY KEY (id);


--
-- Name: BookingWorkPhoto BookingWorkPhoto_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."BookingWorkPhoto"
    ADD CONSTRAINT "BookingWorkPhoto_pkey" PRIMARY KEY (id);


--
-- Name: Booking Booking_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Booking"
    ADD CONSTRAINT "Booking_pkey" PRIMARY KEY (id);


--
-- Name: City City_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."City"
    ADD CONSTRAINT "City_pkey" PRIMARY KEY (id);


--
-- Name: Coupon Coupon_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Coupon"
    ADD CONSTRAINT "Coupon_pkey" PRIMARY KEY (id);


--
-- Name: DeviceToken DeviceToken_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DeviceToken"
    ADD CONSTRAINT "DeviceToken_pkey" PRIMARY KEY (id);


--
-- Name: Dispute Dispute_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Dispute"
    ADD CONSTRAINT "Dispute_pkey" PRIMARY KEY (id);


--
-- Name: FAQ FAQ_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FAQ"
    ADD CONSTRAINT "FAQ_pkey" PRIMARY KEY (id);


--
-- Name: HelperAvailability HelperAvailability_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HelperAvailability"
    ADD CONSTRAINT "HelperAvailability_pkey" PRIMARY KEY (id);


--
-- Name: HelperBank HelperBank_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HelperBank"
    ADD CONSTRAINT "HelperBank_pkey" PRIMARY KEY (id);


--
-- Name: HelperKyc HelperKyc_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HelperKyc"
    ADD CONSTRAINT "HelperKyc_pkey" PRIMARY KEY (id);


--
-- Name: HelperLocation HelperLocation_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HelperLocation"
    ADD CONSTRAINT "HelperLocation_pkey" PRIMARY KEY (id);


--
-- Name: HelperProfile HelperProfile_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HelperProfile"
    ADD CONSTRAINT "HelperProfile_pkey" PRIMARY KEY (id);


--
-- Name: HelperService HelperService_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HelperService"
    ADD CONSTRAINT "HelperService_pkey" PRIMARY KEY (id);


--
-- Name: Helper Helper_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Helper"
    ADD CONSTRAINT "Helper_pkey" PRIMARY KEY (id);


--
-- Name: KiranaCategory KiranaCategory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."KiranaCategory"
    ADD CONSTRAINT "KiranaCategory_pkey" PRIMARY KEY (id);


--
-- Name: KiranaProduct KiranaProduct_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."KiranaProduct"
    ADD CONSTRAINT "KiranaProduct_pkey" PRIMARY KEY (id);


--
-- Name: LaundryCatalogItem LaundryCatalogItem_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LaundryCatalogItem"
    ADD CONSTRAINT "LaundryCatalogItem_pkey" PRIMARY KEY (id);


--
-- Name: LaundryCatalogService LaundryCatalogService_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LaundryCatalogService"
    ADD CONSTRAINT "LaundryCatalogService_pkey" PRIMARY KEY (id);


--
-- Name: LedgerEntry LedgerEntry_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LedgerEntry"
    ADD CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY (id);


--
-- Name: NotificationLog NotificationLog_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."NotificationLog"
    ADD CONSTRAINT "NotificationLog_pkey" PRIMARY KEY (id);


--
-- Name: OtpSecurity OtpSecurity_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."OtpSecurity"
    ADD CONSTRAINT "OtpSecurity_pkey" PRIMARY KEY (id);


--
-- Name: Otp Otp_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Otp"
    ADD CONSTRAINT "Otp_pkey" PRIMARY KEY (id);


--
-- Name: Payment Payment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_pkey" PRIMARY KEY (id);


--
-- Name: PlatformAnnouncement PlatformAnnouncement_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PlatformAnnouncement"
    ADD CONSTRAINT "PlatformAnnouncement_pkey" PRIMARY KEY (id);


--
-- Name: PlatformCategory PlatformCategory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PlatformCategory"
    ADD CONSTRAINT "PlatformCategory_pkey" PRIMARY KEY (id);


--
-- Name: PlatformCategory PlatformCategory_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PlatformCategory"
    ADD CONSTRAINT "PlatformCategory_slug_key" UNIQUE (slug);


--
-- Name: PlatformNotification PlatformNotification_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PlatformNotification"
    ADD CONSTRAINT "PlatformNotification_pkey" PRIMARY KEY (id);


--
-- Name: PlatformOtp PlatformOtp_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PlatformOtp"
    ADD CONSTRAINT "PlatformOtp_pkey" PRIMARY KEY (id);


--
-- Name: PlatformSetting PlatformSetting_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PlatformSetting"
    ADD CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY (id);


--
-- Name: Rating Rating_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Rating"
    ADD CONSTRAINT "Rating_pkey" PRIMARY KEY (id);


--
-- Name: RefreshToken RefreshToken_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."RefreshToken"
    ADD CONSTRAINT "RefreshToken_pkey" PRIMARY KEY (id);


--
-- Name: SellerOrder SellerOrder_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SellerOrder"
    ADD CONSTRAINT "SellerOrder_pkey" PRIMARY KEY (id);


--
-- Name: SellerWorker SellerWorker_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SellerWorker"
    ADD CONSTRAINT "SellerWorker_pkey" PRIMARY KEY (id);


--
-- Name: SellerWorker SellerWorker_workerId_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SellerWorker"
    ADD CONSTRAINT "SellerWorker_workerId_key" UNIQUE ("workerId");


--
-- Name: Seller Seller_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Seller"
    ADD CONSTRAINT "Seller_pkey" PRIMARY KEY (id);


--
-- Name: ServiceCategory ServiceCategory_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ServiceCategory"
    ADD CONSTRAINT "ServiceCategory_name_key" UNIQUE (name);


--
-- Name: ServiceCategory ServiceCategory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ServiceCategory"
    ADD CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY (id);


--
-- Name: ServiceCoverage ServiceCoverage_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ServiceCoverage"
    ADD CONSTRAINT "ServiceCoverage_pkey" PRIMARY KEY (id);


--
-- Name: ServicePlan ServicePlan_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ServicePlan"
    ADD CONSTRAINT "ServicePlan_pkey" PRIMARY KEY (id);


--
-- Name: Service Service_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Service"
    ADD CONSTRAINT "Service_pkey" PRIMARY KEY (id);


--
-- Name: SupportTicket SupportTicket_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SupportTicket"
    ADD CONSTRAINT "SupportTicket_pkey" PRIMARY KEY (id);


--
-- Name: UserAddress UserAddress_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."UserAddress"
    ADD CONSTRAINT "UserAddress_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: pan_verification pan_verification_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pan_verification
    ADD CONSTRAINT pan_verification_pkey PRIMARY KEY (id);


--
-- Name: Area_pincode_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Area_pincode_idx" ON public."Area" USING btree (pincode);


--
-- Name: AuthAudit_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AuthAudit_createdAt_idx" ON public."AuthAudit" USING btree ("createdAt");


--
-- Name: AuthAudit_event_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AuthAudit_event_idx" ON public."AuthAudit" USING btree (event);


--
-- Name: AuthAudit_phone_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AuthAudit_phone_idx" ON public."AuthAudit" USING btree (phone);


--
-- Name: AuthAudit_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AuthAudit_userId_idx" ON public."AuthAudit" USING btree ("userId");


--
-- Name: BookingIssue_bookingId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "BookingIssue_bookingId_idx" ON public."BookingIssue" USING btree ("bookingId");


--
-- Name: BookingIssue_helperId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "BookingIssue_helperId_idx" ON public."BookingIssue" USING btree ("helperId");


--
-- Name: BookingIssue_resolved_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "BookingIssue_resolved_idx" ON public."BookingIssue" USING btree (resolved);


--
-- Name: BookingRequest_customerId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "BookingRequest_customerId_idx" ON public."BookingRequest" USING btree ("customerId");


--
-- Name: BookingRequest_expiresAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "BookingRequest_expiresAt_idx" ON public."BookingRequest" USING btree ("expiresAt");


--
-- Name: BookingRequest_helperId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "BookingRequest_helperId_idx" ON public."BookingRequest" USING btree ("helperId");


--
-- Name: BookingRequest_serviceId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "BookingRequest_serviceId_idx" ON public."BookingRequest" USING btree ("serviceId");


--
-- Name: BookingRequest_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "BookingRequest_status_idx" ON public."BookingRequest" USING btree (status);


--
-- Name: BookingWorkPhoto_bookingId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "BookingWorkPhoto_bookingId_idx" ON public."BookingWorkPhoto" USING btree ("bookingId");


--
-- Name: BookingWorkPhoto_bookingId_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "BookingWorkPhoto_bookingId_type_idx" ON public."BookingWorkPhoto" USING btree ("bookingId", type);


--
-- Name: Booking_bookingRequestId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Booking_bookingRequestId_key" ON public."Booking" USING btree ("bookingRequestId");


--
-- Name: Booking_customerId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Booking_customerId_idx" ON public."Booking" USING btree ("customerId");


--
-- Name: Booking_helperId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Booking_helperId_idx" ON public."Booking" USING btree ("helperId");


--
-- Name: Booking_paymentExpiresAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Booking_paymentExpiresAt_idx" ON public."Booking" USING btree ("paymentExpiresAt");


--
-- Name: Booking_payoutStatus_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Booking_payoutStatus_idx" ON public."Booking" USING btree ("payoutStatus");


--
-- Name: Booking_reservedHelperId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Booking_reservedHelperId_idx" ON public."Booking" USING btree ("reservedHelperId");


--
-- Name: Booking_startedAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Booking_startedAt_idx" ON public."Booking" USING btree ("startedAt");


--
-- Name: Booking_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Booking_status_idx" ON public."Booking" USING btree (status);


--
-- Name: Coupon_code_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Coupon_code_idx" ON public."Coupon" USING btree (code);


--
-- Name: Coupon_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Coupon_code_key" ON public."Coupon" USING btree (code);


--
-- Name: Coupon_isActive_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Coupon_isActive_idx" ON public."Coupon" USING btree ("isActive");


--
-- Name: DeviceToken_token_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "DeviceToken_token_key" ON public."DeviceToken" USING btree (token);


--
-- Name: DeviceToken_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "DeviceToken_userId_idx" ON public."DeviceToken" USING btree ("userId");


--
-- Name: Dispute_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Dispute_status_idx" ON public."Dispute" USING btree (status);


--
-- Name: Dispute_ticketId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Dispute_ticketId_idx" ON public."Dispute" USING btree ("ticketId");


--
-- Name: Dispute_ticketId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Dispute_ticketId_key" ON public."Dispute" USING btree ("ticketId");


--
-- Name: HelperAvailability_helperId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "HelperAvailability_helperId_idx" ON public."HelperAvailability" USING btree ("helperId");


--
-- Name: HelperAvailability_helperId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "HelperAvailability_helperId_key" ON public."HelperAvailability" USING btree ("helperId");


--
-- Name: HelperBank_helperId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "HelperBank_helperId_idx" ON public."HelperBank" USING btree ("helperId");


--
-- Name: HelperBank_helperId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "HelperBank_helperId_key" ON public."HelperBank" USING btree ("helperId");


--
-- Name: HelperKyc_helperId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "HelperKyc_helperId_idx" ON public."HelperKyc" USING btree ("helperId");


--
-- Name: HelperKyc_helperId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "HelperKyc_helperId_key" ON public."HelperKyc" USING btree ("helperId");


--
-- Name: HelperKyc_idfyRequestId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "HelperKyc_idfyRequestId_idx" ON public."HelperKyc" USING btree ("idfyRequestId");


--
-- Name: HelperKyc_idfyRequestId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "HelperKyc_idfyRequestId_key" ON public."HelperKyc" USING btree ("idfyRequestId");


--
-- Name: HelperKyc_panNumber_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "HelperKyc_panNumber_idx" ON public."HelperKyc" USING btree ("panNumber");


--
-- Name: HelperKyc_panNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "HelperKyc_panNumber_key" ON public."HelperKyc" USING btree ("panNumber");


--
-- Name: HelperLocation_helperId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "HelperLocation_helperId_idx" ON public."HelperLocation" USING btree ("helperId");


--
-- Name: HelperLocation_helperId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "HelperLocation_helperId_key" ON public."HelperLocation" USING btree ("helperId");


--
-- Name: HelperProfile_helperId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "HelperProfile_helperId_idx" ON public."HelperProfile" USING btree ("helperId");


--
-- Name: HelperProfile_helperId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "HelperProfile_helperId_key" ON public."HelperProfile" USING btree ("helperId");


--
-- Name: HelperService_helperId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "HelperService_helperId_idx" ON public."HelperService" USING btree ("helperId");


--
-- Name: HelperService_helperId_serviceId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "HelperService_helperId_serviceId_key" ON public."HelperService" USING btree ("helperId", "serviceId");


--
-- Name: HelperService_serviceId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "HelperService_serviceId_idx" ON public."HelperService" USING btree ("serviceId");


--
-- Name: Helper_isAvailable_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Helper_isAvailable_idx" ON public."Helper" USING btree ("isAvailable");


--
-- Name: Helper_isOnline_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Helper_isOnline_idx" ON public."Helper" USING btree ("isOnline");


--
-- Name: Helper_onboardingStatus_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Helper_onboardingStatus_idx" ON public."Helper" USING btree ("onboardingStatus");


--
-- Name: Helper_payoutSetupStatus_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Helper_payoutSetupStatus_idx" ON public."Helper" USING btree ("payoutSetupStatus");


--
-- Name: Helper_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Helper_userId_idx" ON public."Helper" USING btree ("userId");


--
-- Name: Helper_userId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Helper_userId_key" ON public."Helper" USING btree ("userId");


--
-- Name: KiranaCategory_isActive_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "KiranaCategory_isActive_idx" ON public."KiranaCategory" USING btree ("isActive");


--
-- Name: KiranaCategory_slug_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "KiranaCategory_slug_idx" ON public."KiranaCategory" USING btree (slug);


--
-- Name: KiranaCategory_slug_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "KiranaCategory_slug_key" ON public."KiranaCategory" USING btree (slug);


--
-- Name: KiranaProduct_categoryId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "KiranaProduct_categoryId_idx" ON public."KiranaProduct" USING btree ("categoryId");


--
-- Name: KiranaProduct_isBestseller_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "KiranaProduct_isBestseller_idx" ON public."KiranaProduct" USING btree ("isBestseller");


--
-- Name: KiranaProduct_isFeatured_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "KiranaProduct_isFeatured_idx" ON public."KiranaProduct" USING btree ("isFeatured");


--
-- Name: KiranaProduct_sellerId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "KiranaProduct_sellerId_idx" ON public."KiranaProduct" USING btree ("sellerId");


--
-- Name: KiranaProduct_slug_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "KiranaProduct_slug_idx" ON public."KiranaProduct" USING btree (slug);


--
-- Name: KiranaProduct_slug_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "KiranaProduct_slug_key" ON public."KiranaProduct" USING btree (slug);


--
-- Name: LaundryCatalogItem_category_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "LaundryCatalogItem_category_idx" ON public."LaundryCatalogItem" USING btree (category);


--
-- Name: LaundryCatalogService_slug_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "LaundryCatalogService_slug_idx" ON public."LaundryCatalogService" USING btree (slug);


--
-- Name: LaundryCatalogService_slug_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "LaundryCatalogService_slug_key" ON public."LaundryCatalogService" USING btree (slug);


--
-- Name: LedgerEntry_bookingId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "LedgerEntry_bookingId_idx" ON public."LedgerEntry" USING btree ("bookingId");


--
-- Name: LedgerEntry_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "LedgerEntry_createdAt_idx" ON public."LedgerEntry" USING btree ("createdAt");


--
-- Name: LedgerEntry_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "LedgerEntry_type_idx" ON public."LedgerEntry" USING btree (type);


--
-- Name: LedgerEntry_type_referenceId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "LedgerEntry_type_referenceId_key" ON public."LedgerEntry" USING btree (type, "referenceId");


--
-- Name: LedgerEntry_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "LedgerEntry_userId_idx" ON public."LedgerEntry" USING btree ("userId");


--
-- Name: NotificationLog_isRead_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "NotificationLog_isRead_idx" ON public."NotificationLog" USING btree ("isRead");


--
-- Name: NotificationLog_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "NotificationLog_type_idx" ON public."NotificationLog" USING btree (type);


--
-- Name: NotificationLog_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "NotificationLog_userId_idx" ON public."NotificationLog" USING btree ("userId");


--
-- Name: OtpSecurity_phone_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "OtpSecurity_phone_idx" ON public."OtpSecurity" USING btree (phone);


--
-- Name: OtpSecurity_phone_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "OtpSecurity_phone_key" ON public."OtpSecurity" USING btree (phone);


--
-- Name: Otp_expiresAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Otp_expiresAt_idx" ON public."Otp" USING btree ("expiresAt");


--
-- Name: Otp_phone_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Otp_phone_idx" ON public."Otp" USING btree (phone);


--
-- Name: Payment_bookingId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Payment_bookingId_idx" ON public."Payment" USING btree ("bookingId");


--
-- Name: Payment_bookingId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Payment_bookingId_key" ON public."Payment" USING btree ("bookingId");


--
-- Name: Payment_escrowStatus_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Payment_escrowStatus_idx" ON public."Payment" USING btree ("escrowStatus");


--
-- Name: Payment_razorpayOrderId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Payment_razorpayOrderId_key" ON public."Payment" USING btree ("razorpayOrderId");


--
-- Name: Payment_razorpayPaymentId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Payment_razorpayPaymentId_key" ON public."Payment" USING btree ("razorpayPaymentId");


--
-- Name: Payment_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Payment_status_idx" ON public."Payment" USING btree (status);


--
-- Name: Payment_transactionId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Payment_transactionId_key" ON public."Payment" USING btree ("transactionId");


--
-- Name: Rating_bookingId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Rating_bookingId_key" ON public."Rating" USING btree ("bookingId");


--
-- Name: RefreshToken_expiresAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "RefreshToken_expiresAt_idx" ON public."RefreshToken" USING btree ("expiresAt");


--
-- Name: RefreshToken_tokenHash_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON public."RefreshToken" USING btree ("tokenHash");


--
-- Name: RefreshToken_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "RefreshToken_userId_idx" ON public."RefreshToken" USING btree ("userId");


--
-- Name: SellerOrder_orderNumber_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "SellerOrder_orderNumber_idx" ON public."SellerOrder" USING btree ("orderNumber");


--
-- Name: SellerOrder_orderNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "SellerOrder_orderNumber_key" ON public."SellerOrder" USING btree ("orderNumber");


--
-- Name: SellerOrder_sellerId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "SellerOrder_sellerId_idx" ON public."SellerOrder" USING btree ("sellerId");


--
-- Name: SellerOrder_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "SellerOrder_status_idx" ON public."SellerOrder" USING btree (status);


--
-- Name: Seller_businessType_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Seller_businessType_idx" ON public."Seller" USING btree ("businessType");


--
-- Name: Seller_city_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Seller_city_idx" ON public."Seller" USING btree (city);


--
-- Name: Seller_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Seller_email_key" ON public."Seller" USING btree (email);


--
-- Name: Seller_phone_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Seller_phone_key" ON public."Seller" USING btree (phone);


--
-- Name: Seller_pincode_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Seller_pincode_idx" ON public."Seller" USING btree (pincode);


--
-- Name: Seller_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Seller_status_idx" ON public."Seller" USING btree (status);


--
-- Name: ServiceCoverage_areaId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ServiceCoverage_areaId_idx" ON public."ServiceCoverage" USING btree ("areaId");


--
-- Name: ServiceCoverage_serviceId_areaId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ServiceCoverage_serviceId_areaId_key" ON public."ServiceCoverage" USING btree ("serviceId", "areaId");


--
-- Name: ServicePlan_serviceId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ServicePlan_serviceId_idx" ON public."ServicePlan" USING btree ("serviceId");


--
-- Name: SupportTicket_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "SupportTicket_createdAt_idx" ON public."SupportTicket" USING btree ("createdAt");


--
-- Name: SupportTicket_helperId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "SupportTicket_helperId_idx" ON public."SupportTicket" USING btree ("helperId");


--
-- Name: SupportTicket_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "SupportTicket_status_idx" ON public."SupportTicket" USING btree (status);


--
-- Name: UserAddress_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "UserAddress_userId_idx" ON public."UserAddress" USING btree ("userId");


--
-- Name: User_phone_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "User_phone_key" ON public."User" USING btree (phone);


--
-- Name: idx_announcement_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_announcement_created ON public."PlatformAnnouncement" USING btree ("createdAt");


--
-- Name: idx_coupon_category_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_coupon_category_id ON public."Coupon" USING btree ("categoryId");


--
-- Name: idx_dispute_category_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dispute_category_id ON public."Dispute" USING btree ("categoryId");


--
-- Name: idx_faq_cat_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_faq_cat_id ON public."FAQ" USING btree ("categoryId");


--
-- Name: idx_faq_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_faq_category ON public."FAQ" USING btree (category);


--
-- Name: idx_notification_recip; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_recip ON public."PlatformNotification" USING btree ("recipientType", "recipientEmail");


--
-- Name: idx_platform_cat_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_platform_cat_active ON public."PlatformCategory" USING btree ("isActive");


--
-- Name: idx_platform_cat_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_platform_cat_slug ON public."PlatformCategory" USING btree (slug);


--
-- Name: idx_platform_otp_email_purpose; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_platform_otp_email_purpose ON public."PlatformOtp" USING btree (email, purpose);


--
-- Name: idx_seller_category_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_seller_category_id ON public."Seller" USING btree ("categoryId");


--
-- Name: idx_seller_order_cat_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_seller_order_cat_id ON public."SellerOrder" USING btree ("categoryId");


--
-- Name: idx_seller_order_worker_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_seller_order_worker_id ON public."SellerOrder" USING btree ("assignedWorkerId");


--
-- Name: idx_seller_worker_sellerId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_seller_worker_sellerId" ON public."SellerWorker" USING btree ("sellerId");


--
-- Name: idx_seller_worker_workerId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_seller_worker_workerId" ON public."SellerWorker" USING btree ("workerId");


--
-- Name: idx_service_cat_platform_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_service_cat_platform_id ON public."ServiceCategory" USING btree ("platformCategoryId");


--
-- Name: idx_user_email_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_user_email_unique ON public."User" USING btree (email) WHERE (email IS NOT NULL);


--
-- Name: idx_worker_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_worker_email ON public."SellerWorker" USING btree (email);


--
-- Name: idx_worker_seller_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_worker_seller_id ON public."SellerWorker" USING btree ("sellerId");


--
-- Name: pan_verification_panNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "pan_verification_panNumber_key" ON public.pan_verification USING btree ("panNumber");


--
-- Name: pan_verification_userId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "pan_verification_userId_key" ON public.pan_verification USING btree ("userId");


--
-- Name: Area Area_cityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Area"
    ADD CONSTRAINT "Area_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES public."City"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: BookingIssue BookingIssue_bookingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."BookingIssue"
    ADD CONSTRAINT "BookingIssue_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES public."Booking"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: BookingRequest BookingRequest_bookingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."BookingRequest"
    ADD CONSTRAINT "BookingRequest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES public."Booking"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BookingRequest BookingRequest_helperId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."BookingRequest"
    ADD CONSTRAINT "BookingRequest_helperId_fkey" FOREIGN KEY ("helperId") REFERENCES public."Helper"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BookingRequest BookingRequest_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."BookingRequest"
    ADD CONSTRAINT "BookingRequest_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public."Service"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: BookingRequest BookingRequest_servicePlanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."BookingRequest"
    ADD CONSTRAINT "BookingRequest_servicePlanId_fkey" FOREIGN KEY ("servicePlanId") REFERENCES public."ServicePlan"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: BookingWorkPhoto BookingWorkPhoto_bookingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."BookingWorkPhoto"
    ADD CONSTRAINT "BookingWorkPhoto_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES public."Booking"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Booking Booking_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Booking"
    ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Booking Booking_helperId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Booking"
    ADD CONSTRAINT "Booking_helperId_fkey" FOREIGN KEY ("helperId") REFERENCES public."Helper"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Booking Booking_reservedHelperId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Booking"
    ADD CONSTRAINT "Booking_reservedHelperId_fkey" FOREIGN KEY ("reservedHelperId") REFERENCES public."Helper"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Booking Booking_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Booking"
    ADD CONSTRAINT "Booking_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public."Service"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Booking Booking_servicePlanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Booking"
    ADD CONSTRAINT "Booking_servicePlanId_fkey" FOREIGN KEY ("servicePlanId") REFERENCES public."ServicePlan"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Coupon Coupon_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Coupon"
    ADD CONSTRAINT "Coupon_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."PlatformCategory"(id) ON DELETE SET NULL;


--
-- Name: DeviceToken DeviceToken_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DeviceToken"
    ADD CONSTRAINT "DeviceToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Dispute Dispute_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Dispute"
    ADD CONSTRAINT "Dispute_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."PlatformCategory"(id) ON DELETE SET NULL;


--
-- Name: FAQ FAQ_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FAQ"
    ADD CONSTRAINT "FAQ_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."PlatformCategory"(id) ON DELETE SET NULL;


--
-- Name: HelperAvailability HelperAvailability_helperId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HelperAvailability"
    ADD CONSTRAINT "HelperAvailability_helperId_fkey" FOREIGN KEY ("helperId") REFERENCES public."Helper"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: HelperBank HelperBank_helperId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HelperBank"
    ADD CONSTRAINT "HelperBank_helperId_fkey" FOREIGN KEY ("helperId") REFERENCES public."Helper"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: HelperKyc HelperKyc_helperId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HelperKyc"
    ADD CONSTRAINT "HelperKyc_helperId_fkey" FOREIGN KEY ("helperId") REFERENCES public."Helper"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: HelperLocation HelperLocation_helperId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HelperLocation"
    ADD CONSTRAINT "HelperLocation_helperId_fkey" FOREIGN KEY ("helperId") REFERENCES public."Helper"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: HelperProfile HelperProfile_helperId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HelperProfile"
    ADD CONSTRAINT "HelperProfile_helperId_fkey" FOREIGN KEY ("helperId") REFERENCES public."Helper"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: HelperService HelperService_helperId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HelperService"
    ADD CONSTRAINT "HelperService_helperId_fkey" FOREIGN KEY ("helperId") REFERENCES public."Helper"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: HelperService HelperService_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HelperService"
    ADD CONSTRAINT "HelperService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public."Service"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Helper Helper_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Helper"
    ADD CONSTRAINT "Helper_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: KiranaProduct KiranaProduct_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."KiranaProduct"
    ADD CONSTRAINT "KiranaProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."KiranaCategory"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: KiranaProduct KiranaProduct_sellerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."KiranaProduct"
    ADD CONSTRAINT "KiranaProduct_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES public."Seller"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: NotificationLog NotificationLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."NotificationLog"
    ADD CONSTRAINT "NotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Payment Payment_bookingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES public."Booking"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Rating Rating_bookingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Rating"
    ADD CONSTRAINT "Rating_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES public."Booking"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Rating Rating_helperId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Rating"
    ADD CONSTRAINT "Rating_helperId_fkey" FOREIGN KEY ("helperId") REFERENCES public."Helper"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Rating Rating_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Rating"
    ADD CONSTRAINT "Rating_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RefreshToken RefreshToken_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."RefreshToken"
    ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SellerOrder SellerOrder_sellerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SellerOrder"
    ADD CONSTRAINT "SellerOrder_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES public."Seller"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SellerWorker SellerWorker_sellerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SellerWorker"
    ADD CONSTRAINT "SellerWorker_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES public."Seller"(id) ON DELETE CASCADE;


--
-- Name: ServiceCategory ServiceCategory_platformCategoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ServiceCategory"
    ADD CONSTRAINT "ServiceCategory_platformCategoryId_fkey" FOREIGN KEY ("platformCategoryId") REFERENCES public."PlatformCategory"(id) ON DELETE SET NULL;


--
-- Name: ServiceCoverage ServiceCoverage_areaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ServiceCoverage"
    ADD CONSTRAINT "ServiceCoverage_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES public."Area"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ServiceCoverage ServiceCoverage_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ServiceCoverage"
    ADD CONSTRAINT "ServiceCoverage_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public."Service"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ServicePlan ServicePlan_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ServicePlan"
    ADD CONSTRAINT "ServicePlan_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public."Service"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SupportTicket SupportTicket_helperId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SupportTicket"
    ADD CONSTRAINT "SupportTicket_helperId_fkey" FOREIGN KEY ("helperId") REFERENCES public."Helper"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserAddress UserAddress_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."UserAddress"
    ADD CONSTRAINT "UserAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: pan_verification pan_verification_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pan_verification
    ADD CONSTRAINT "pan_verification_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict CnfcFg1KpojztQoAXmQSJU7JyolVEeW6eUH2vNheoNQIsFsKUo6LcE5jEVRDh06

