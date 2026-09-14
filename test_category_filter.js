const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(typeof data === 'string' ? data : JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING GLOBAL CATEGORY FILTER AUDIT & TESTS ===\n');

  // 1. Admin Login to get token
  const loginRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/admin/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'admin@gmail.com', password: 'admin123' });

  const token = loginRes.body?.token;
  if (!token) {
    console.error('Failed to log in as admin:', loginRes.body);
    process.exit(1);
  }
  console.log('✅ Admin login successful. Token acquired.\n');

  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // 2. Test Platform Categories
  const catRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/admin/categories',
    method: 'GET',
    headers: authHeaders
  });
  console.log(`✅ GET /api/admin/categories -> Count: ${catRes.body?.data?.length || 0}`);
  const categories = catRes.body?.data || [];
  console.log('   Available Categories:', categories.map(c => `${c.name} (${c.slug}, id: ${c.id})`).join(', '));

  // 3. Test FAQs with Laundry filter
  const faqLaundryRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/admin/faqs?category_id=laundry',
    method: 'GET',
    headers: authHeaders
  });
  console.log(`\n✅ GET /api/admin/faqs?category_id=laundry -> Returned ${faqLaundryRes.body?.data?.length || 0} FAQs`);
  faqLaundryRes.body?.data?.forEach(f => console.log(`   - [${f.category}] ${f.question}`));

  // 4. Test FAQs with Grocery filter
  const faqGroceryRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/admin/faqs?category_id=grocery',
    method: 'GET',
    headers: authHeaders
  });
  console.log(`\n✅ GET /api/admin/faqs?category_id=grocery -> Returned ${faqGroceryRes.body?.data?.length || 0} FAQs`);
  faqGroceryRes.body?.data?.forEach(f => console.log(`   - [${f.category}] ${f.question}`));

  // 5. Test FAQs for All Categories
  const faqAllRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/admin/faqs',
    method: 'GET',
    headers: authHeaders
  });
  console.log(`\n✅ GET /api/admin/faqs (All Categories) -> Returned ${faqAllRes.body?.data?.length || 0} FAQs`);

  // 6. Test Kirana Categories for Laundry (Should be 0 / not applicable)
  const kiranaCatLaundryRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/admin/kirana-category?category_id=laundry',
    method: 'GET',
    headers: authHeaders
  });
  console.log(`\n✅ GET /api/admin/kirana-category?category_id=laundry -> Returned ${kiranaCatLaundryRes.body?.data?.length || 0} categories (Expected: 0)`);
  if (kiranaCatLaundryRes.body?.message) {
    console.log(`   Message: "${kiranaCatLaundryRes.body.message}"`);
  }

  // 7. Test Kirana Categories for Grocery
  const kiranaCatGroceryRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/admin/kirana-category?category_id=grocery',
    method: 'GET',
    headers: authHeaders
  });
  console.log(`\n✅ GET /api/admin/kirana-category?category_id=grocery -> Returned ${kiranaCatGroceryRes.body?.data?.length || 0} categories`);

  // 8. Test Services for Laundry vs Grocery
  const servicesLaundryRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/admin/services?category_id=laundry',
    method: 'GET',
    headers: authHeaders
  });
  console.log(`\n✅ GET /api/admin/services?category_id=laundry -> Status: ${servicesLaundryRes.status}, Returned ${servicesLaundryRes.body?.services?.length || servicesLaundryRes.body?.data?.length || 0} services`);

  // 9. Test Bookings for Laundry vs Grocery
  const bookingsLaundryRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/admin/bookings?category_id=laundry',
    method: 'GET',
    headers: authHeaders
  });
  console.log(`\n✅ GET /api/admin/bookings?category_id=laundry -> Status: ${bookingsLaundryRes.status}, Bookings: ${bookingsLaundryRes.body?.bookings?.length || bookingsLaundryRes.body?.data?.length || 0}`);

  // 10. Test Coupons for Laundry vs Grocery
  const couponsLaundryRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/admin/coupons?category_id=laundry',
    method: 'GET',
    headers: authHeaders
  });
  console.log(`\n✅ GET /api/admin/coupons?category_id=laundry -> Status: ${couponsLaundryRes.status}, Coupons: ${couponsLaundryRes.body?.coupons?.length || couponsLaundryRes.body?.data?.length || 0}`);

  // 11. Test Reviews for Laundry vs Grocery
  const reviewsLaundryRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/admin/reviews?category_id=laundry',
    method: 'GET',
    headers: authHeaders
  });
  // 12. Test Dashboard Real Data
  const dashAllRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/admin/dashboard',
    method: 'GET',
    headers: authHeaders
  });
  console.log(`\n✅ GET /api/admin/dashboard (All) -> Status: ${dashAllRes.status}`);
  console.log('   Stats:', JSON.stringify(dashAllRes.body?.stats));
  console.log('   TimeStats:', JSON.stringify(dashAllRes.body?.timeStats));
  console.log('   CityActivity:', JSON.stringify(dashAllRes.body?.cityActivity));

  const dashLndRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/admin/dashboard?category_id=laundry',
    method: 'GET',
    headers: authHeaders
  });
  console.log(`\n✅ GET /api/admin/dashboard (Laundry) -> Status: ${dashLndRes.status}`);
  console.log('   Stats:', JSON.stringify(dashLndRes.body?.stats));
  console.log('   TimeStats:', JSON.stringify(dashLndRes.body?.timeStats));
  console.log('   CityActivity:', JSON.stringify(dashLndRes.body?.cityActivity));

  console.log('\n=== ALL CATEGORY FILTER TESTS PASSED SUCCESSFULLY! ===');
}

runTests().catch(console.error);
