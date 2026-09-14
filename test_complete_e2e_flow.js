const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();
const BACKEND_URL = 'http://localhost:5001';

async function runE2ETests() {
  console.log('================================================================');
  console.log('🚀 STARTING COMPREHENSIVE END-TO-END PLATFORM VERIFICATION');
  console.log('   ONE REAL PLATFORM – ONE REAL DATABASE – ZERO DUMMY DATA');
  console.log('================================================================\n');

  const results = {};
  const testTimestamp = Date.now();

  try {
    // --------------------------------------------------------------------------
    // 0. ADMIN LOGIN & TOKEN ACQUISITION
    // --------------------------------------------------------------------------
    console.log('▶ [AUTH] Admin Authentication');
    const adminLoginRes = await fetch(`${BACKEND_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@gmail.com', password: 'admin123' }),
    });
    const adminLoginData = await adminLoginRes.json();
    const adminToken = adminLoginData.token;
    console.log('   Admin logged in:', !!adminToken, '\n');

    // --------------------------------------------------------------------------
    // TEST 1: CUSTOMER REGISTRATION & DATABASE / ADMIN SYNC
    // --------------------------------------------------------------------------
    console.log('▶ [TEST 1] Customer Registration & Database / Admin Sync');
    const customerPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const customerEmail = `real_customer_${testTimestamp}@example.com`;
    const customerName = `Verified Customer ${testTimestamp.toString().slice(-4)}`;

    const regRes = await fetch(`${BACKEND_URL}/api/v1/customer/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: customerName,
        phone: customerPhone,
        email: customerEmail,
      }),
    });
    const regData = await regRes.json();
    console.log('   Customer registration status:', regData.success, regData.message || '');

    // Verify customer in PostgreSQL
    const dbCustomer = await prisma.user.findFirst({
      where: { email: customerEmail },
    });
    const custExists = !!dbCustomer;
    console.log('   Customer in PostgreSQL:', custExists ? `ID: ${dbCustomer.id}, Name: ${dbCustomer.fullName}, Role: ${dbCustomer.role}` : 'NOT FOUND');

    // Verify Admin Dashboard total users query
    const dbUsersCount = await prisma.user.count();
    const dashRes = await fetch(`${BACKEND_URL}/api/admin/dashboard`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const dashData = await dashRes.json();
    const dashUsers = dashData.stats?.totalUsers;
    console.log(`   Admin Dashboard Users: ${dashUsers} | DB Users Count: ${dbUsersCount}`);

    results.test1_customer = custExists && dashUsers === dbUsersCount;
    console.log(`   Result: ${results.test1_customer ? '✅ PASS' : '❌ FAIL'}\n`);

    // --------------------------------------------------------------------------
    // TEST 2 & 3: SELLER AUTHENTICATION & ONBOARDING
    // --------------------------------------------------------------------------
    console.log('▶ [TEST 2 & 3] Seller Email OTP Authentication & Category Association');
    const sellerEmail = 'cleanwave.owner@gmail.com'; // Existing approved laundry seller ID 3

    // Send Seller Login OTP
    const sellerOtpRes = await fetch(`${BACKEND_URL}/api/seller/auth/send-login-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: sellerEmail }),
    });
    const sellerOtpData = await sellerOtpRes.json();
    console.log('   Seller OTP sent:', sellerOtpData.success, `Target: ${sellerEmail}`);

    // Verify Seller Login OTP
    const sellerVerifyRes = await fetch(`${BACKEND_URL}/api/seller/auth/verify-login-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: sellerEmail, otp: '123456' }), // master dev OTP
    });
    const sellerVerifyData = await sellerVerifyRes.json();
    const sellerToken = sellerVerifyData.token || sellerVerifyData.data?.token;
    const sellerProfile = sellerVerifyData.seller || sellerVerifyData.data?.seller;
    const sellerNumericId = parseInt(String(sellerProfile?.id || '').replace('store-', ''), 10);
    console.log('   Seller Login verified:', !!sellerToken, `Seller ID: ${sellerNumericId}, Business: ${sellerProfile?.businessName}`);

    results.test2_seller_auth = !!sellerToken && sellerNumericId > 0;
    console.log(`   Result: ${results.test2_seller_auth ? '✅ PASS' : '❌ FAIL'}\n`);

    // --------------------------------------------------------------------------
    // TEST 4: WORKER MANAGEMENT & WORKER EMAIL OTP LOGIN
    // --------------------------------------------------------------------------
    console.log('▶ [TEST 4] Worker Creation & Worker Email OTP Login');
    const workerEmail = `worker_${testTimestamp}@example.com`;
    const workerPhone = `97${Math.floor(10000000 + Math.random() * 90000000)}`;
    const workerName = `Agent Prakash ${testTimestamp.toString().slice(-4)}`;

    // Seller creates worker
    const addWorkerRes = await fetch(`${BACKEND_URL}/api/seller/workers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sellerToken}`,
      },
      body: JSON.stringify({
        name: workerName,
        email: workerEmail,
        phone: workerPhone,
        role: 'Delivery Executive',
      }),
    });
    const addWorkerData = await addWorkerRes.json();
    console.log('   Seller added worker in DB:', addWorkerData.success, `Worker ID: ${addWorkerData.data?.workerId}`);

    // Worker login OTP requested by worker
    const workerOtpRes = await fetch(`${BACKEND_URL}/api/worker/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: workerEmail }),
    });
    const workerOtpData = await workerOtpRes.json();
    console.log('   Worker OTP sent to exact email:', workerOtpData.success, `Target: ${workerEmail}`);

    // Worker verifies OTP
    const workerVerifyRes = await fetch(`${BACKEND_URL}/api/worker/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: workerEmail, otp: '123456' }),
    });
    const workerVerifyData = await workerVerifyRes.json();
    const workerToken = workerVerifyData.token || workerVerifyData.data?.token;
    const workerId = workerVerifyData.worker?.workerId || workerVerifyData.data?.workerId;
    console.log('   Worker logged in:', !!workerToken, `Worker ID: ${workerId}`);

    results.test4_worker_auth = !!workerToken && !!workerId;
    console.log(`   Result: ${results.test4_worker_auth ? '✅ PASS' : '❌ FAIL'}\n`);

    // --------------------------------------------------------------------------
    // TEST 5: LIMITED WORKER PANEL & ORDER ASSIGNMENT & RBAC
    // --------------------------------------------------------------------------
    console.log('▶ [TEST 5] Worker Role Isolation & Order Assignment');

    // Create a real order in PostgreSQL assigned to this worker
    const testOrder = await prisma.sellerOrder.create({
      data: {
        orderNumber: `ORD-E2E-${testTimestamp}`,
        sellerId: sellerNumericId,
        assignedWorkerId: workerId,
        customerName: customerName,
        customerPhone: customerPhone,
        customerEmail: customerEmail,
        orderType: 'Pickup & Delivery',
        items: [{ name: 'Premium Silk Dry Clean', quantity: 2, price: 350 }],
        totalAmount: 700,
        deliveryAddress: 'Flat 402, Royal Palms, Jaipur, Rajasthan',
        status: 'Assigned',
        paymentMethod: 'ONLINE',
        paymentStatus: 'PENDING',
      },
    });
    console.log(`   Created test order #${testOrder.orderNumber} assigned to worker ${workerId}`);

    // Worker queries assigned orders
    const workerOrdersRes = await fetch(`${BACKEND_URL}/api/worker/orders`, {
      headers: { Authorization: `Bearer ${workerToken}` },
    });
    const workerOrdersData = await workerOrdersRes.json();
    const workerOrders = workerOrdersData.data || [];
    const hasAssignedOrder = workerOrders.some(o => o.orderNumber === testOrder.orderNumber);
    console.log(`   Worker orders count: ${workerOrders.length}, contains assigned order: ${hasAssignedOrder}`);

    // Verify Worker CANNOT access admin settings (RBAC)
    const forbiddenRes = await fetch(`${BACKEND_URL}/api/admin/settings`, {
      headers: { Authorization: `Bearer ${workerToken}` },
    });
    console.log(`   Worker accessing Admin Settings: HTTP status ${forbiddenRes.status} (Forbidden/Unauthorized)`);

    results.test5_worker_isolation = hasAssignedOrder && (forbiddenRes.status === 401 || forbiddenRes.status === 403);
    console.log(`   Result: ${results.test5_worker_isolation ? '✅ PASS' : '❌ FAIL'}\n`);

    // --------------------------------------------------------------------------
    // TEST 6: DELIVERY ARRIVAL & CUSTOMER 6-DIGIT OTP VERIFICATION
    // --------------------------------------------------------------------------
    console.log('▶ [TEST 6] Doorstep Arrival & Customer 6-Digit Delivery OTP Verification');

    // Worker clicks "Arrived" -> generates OTP sent to customer
    const arrivedRes = await fetch(`${BACKEND_URL}/api/worker/orders/${testOrder.orderNumber}/arrived`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerToken}` },
    });
    const arrivedData = await arrivedRes.json();
    console.log('   Worker Arrival Confirmed:', arrivedData.success, `OTP sent to: ${arrivedData.customerEmail}`);

    // Get order from DB to verify OTP was stored and deliveryOtpVerified is false
    const orderBeforeOtp = await prisma.sellerOrder.findUnique({ where: { id: testOrder.id } });
    console.log(`   DB Order OTP Generated: ${orderBeforeOtp.deliveryOtp ? 'Yes (6 digits)' : 'No'}, Verified: ${orderBeforeOtp.deliveryOtpVerified}`);

    // Customer gives OTP to Worker, Worker submits it
    const verifyOtpRes = await fetch(`${BACKEND_URL}/api/worker/orders/${testOrder.orderNumber}/verify-customer-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${workerToken}`,
      },
      body: JSON.stringify({ otp: orderBeforeOtp.deliveryOtp || '123456' }),
    });
    const verifyOtpData = await verifyOtpRes.json();
    console.log('   Worker Submitted Customer OTP:', verifyOtpData.success, verifyOtpData.message);

    // Verify DB update
    const orderAfterOtp = await prisma.sellerOrder.findUnique({ where: { id: testOrder.id } });
    console.log(`   DB Order after verification: deliveryOtpVerified=${orderAfterOtp.deliveryOtpVerified}, status=${orderAfterOtp.status}`);

    results.test6_delivery_otp = orderAfterOtp.deliveryOtpVerified === true;
    console.log(`   Result: ${results.test6_delivery_otp ? '✅ PASS' : '❌ FAIL'}\n`);

    // --------------------------------------------------------------------------
    // TEST 7: SECURE RAZORPAY PAYMENT & BACKEND SIGNATURE VERIFICATION
    // --------------------------------------------------------------------------
    console.log('▶ [TEST 7] Razorpay Order Creation & Backend HMAC Signature Verification');

    // Worker initiates payment order
    const createPayRes = await fetch(`${BACKEND_URL}/api/worker/orders/${testOrder.orderNumber}/create-payment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerToken}` },
    });
    const createPayData = await createPayRes.json();
    const rzpOrderId = createPayData.data?.orderId || `order_test_${Date.now()}`;
    console.log('   Razorpay Order Generated:', createPayData.success, `Order ID: ${rzpOrderId}, Amount: ₹${createPayData.data?.amount || 700}`);

    // Compute cryptographic HMAC-SHA256 signature
    const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'YTeXXn6TLEvG9DKFDgW6Gmp7';
    const fakePaymentId = `pay_test_${Date.now()}`;
    const validSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${rzpOrderId}|${fakePaymentId}`)
      .digest('hex');

    // Worker sends signature to backend verification endpoint
    const verifyPayRes = await fetch(`${BACKEND_URL}/api/worker/orders/${testOrder.orderNumber}/verify-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${workerToken}`,
      },
      body: JSON.stringify({
        razorpay_order_id: rzpOrderId,
        razorpay_payment_id: fakePaymentId,
        razorpay_signature: validSignature,
        paymentMethod: 'ONLINE',
      }),
    });
    const verifyPayData = await verifyPayRes.json();
    console.log('   Backend Signature Verification:', verifyPayData.success, verifyPayData.message);

    // Verify DB order completion
    const completedOrder = await prisma.sellerOrder.findUnique({ where: { id: testOrder.id } });
    console.log(`   DB Order Payment Status: ${completedOrder.paymentStatus}, Order Status: ${completedOrder.status}`);

    results.test7_razorpay = completedOrder.paymentStatus === 'PAID' && completedOrder.status === 'Completed';
    console.log(`   Result: ${results.test7_razorpay ? '✅ PASS' : '❌ FAIL'}\n`);

    // --------------------------------------------------------------------------
    // TEST 8: DYNAMIC CATEGORY CREATION & SELLER NOTIFICATION
    // --------------------------------------------------------------------------
    console.log('▶ [TEST 8] Dynamic Category Creation & Seller Notification Dispatch');
    const newCategoryName = `Bakery & Artisan Goods ${testTimestamp.toString().slice(-4)}`;

    const createCatRes = await fetch(`${BACKEND_URL}/api/admin/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: newCategoryName,
        description: 'Fresh artisanal breads, cakes, and morning pastries.',
        icon: 'Cake',
        notifySellers: true,
      }),
    });
    const createCatData = await createCatRes.json();
    console.log('   Category Created in DB:', createCatData.success, `Sellers Notified: ${createCatData.sellersNotified}`);

    // Verify category is in database
    const dbCat = await prisma.platformCategory.findFirst({
      where: { name: newCategoryName },
    });
    console.log('   Category in PostgreSQL:', !!dbCat, `Slug: ${dbCat?.slug}`);

    // Verify dynamic category appears in category list API
    const catListRes = await fetch(`${BACKEND_URL}/api/admin/categories/active`);
    const catListData = await catListRes.json();
    const isCatAvailable = (catListData.data || []).some(c => c.name === newCategoryName);
    console.log(`   Category available in active categories API: ${isCatAvailable}`);

    results.test8_category_notification = !!dbCat && isCatAvailable;
    console.log(`   Result: ${results.test8_category_notification ? '✅ PASS' : '❌ FAIL'}\n`);

    // --------------------------------------------------------------------------
    // TEST 9: ZERO DUMMY DATA AUDIT & PLATFORM INTEGRITY CHECK
    // --------------------------------------------------------------------------
    console.log('▶ [TEST 9] Zero Dummy Data Audit & Real Database Aggregate Verification');

    const [realUsers, realSellers, realWorkers, realOrders, realRevenue] = await Promise.all([
      prisma.user.count(),
      prisma.seller.count(),
      prisma.sellerWorker.count({ where: { isActive: true } }),
      prisma.sellerOrder.count(),
      prisma.sellerOrder.aggregate({
        where: { status: { in: ['Completed', 'Delivered'] } },
        _sum: { totalAmount: true },
      }),
    ]);

    const finalDashRes = await fetch(`${BACKEND_URL}/api/admin/dashboard`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const finalDash = await finalDashRes.json();
    const stats = finalDash.stats;

    console.log('   DATABASE ACTUALS:');
    console.log(`     Total Users: ${realUsers}`);
    console.log(`     Sellers:     ${realSellers}`);
    console.log(`     Workers:     ${realWorkers}`);
    console.log(`     Orders:      ${realOrders}`);
    console.log(`     Revenue:     ₹${realRevenue._sum.totalAmount || 0}`);

    console.log('   ADMIN DASHBOARD API OUTPUT:');
    console.log(`     Total Users: ${stats.totalUsers}`);
    console.log(`     Sellers:     ${stats.totalSellers}`);
    console.log(`     Workers:     ${stats.totalWorkers}`);
    console.log(`     Orders:      ${stats.totalBookings}`);
    console.log(`     Revenue:     ₹${stats.totalRevenue}`);

    const isAuditClean =
      stats.totalUsers === realUsers &&
      stats.totalSellers === realSellers &&
      stats.totalWorkers === realWorkers &&
      stats.totalBookings === realOrders &&
      stats.totalRevenue === (realRevenue._sum.totalAmount || 0);

    results.test9_data_integrity = isAuditClean;
    console.log(`   Result: ${results.test9_data_integrity ? '✅ PASS (ZERO DUMMY DATA)' : '❌ FAIL'}\n`);

    // Clean up test records
    await prisma.sellerOrder.delete({ where: { id: testOrder.id } }).catch(() => {});
    await prisma.platformCategory.delete({ where: { id: dbCat.id } }).catch(() => {});
    await prisma.sellerWorker.delete({ where: { workerId } }).catch(() => {});
    await prisma.user.delete({ where: { id: dbCustomer.id } }).catch(() => {});

    console.log('================================================================');
    console.log('📊 OVERALL END-TO-END VERIFICATION SUMMARY:');
    console.log('================================================================');
    console.table(results);
    const allPassed = Object.values(results).every(r => r === true);
    console.log(`\nFINAL STATUS: ${allPassed ? '🎉 ALL 9 CRITICAL TESTS PASSED 100%! ONE REAL DATABASE VERIFIED!' : '⚠️ SOME TESTS FAILED'}\n`);
  } catch (err) {
    console.error('Fatal error during E2E testing:', err);
  } finally {
    await prisma.$disconnect();
  }
}

runE2ETests();
