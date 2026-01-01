// test-auth.js - Test the authentication endpoints locally
const http = require('http');

const testUser = {
    email: `test_${Date.now()}@example.com`,
    password: 'TestPassword123!',
    username: 'TestUser'
};

function makeRequest(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (token) {
            options.headers.Authorization = `Bearer ${token}`;
        }

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({
                        status: res.statusCode,
                        data: parsed
                    });
                } catch {
                    resolve({
                        status: res.statusCode,
                        data: data
                    });
                }
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function runTests() {
    console.log('🧪 Testing Authentication API\n');

    // 1. Test Registration
    console.log('1. Testing Registration...');
    const regResult = await makeRequest('POST', '/api/auth/register', testUser);
    
    if (regResult.status === 201 && regResult.data.ok) {
        console.log('✅ Registration successful!');
        const token = regResult.data.token;
        const userId = regResult.data.user.id;

        // 2. Test Login
        console.log('\n2. Testing Login...');
        const loginResult = await makeRequest('POST', '/api/auth/login', {
            email: testUser.email,
            password: testUser.password
        });

        if (loginResult.status === 200 && loginResult.data.ok) {
            console.log('✅ Login successful!');
            
            // 3. Test /me endpoint
            console.log('\n3. Testing /me endpoint...');
            const meResult = await makeRequest('GET', '/api/auth/me', null, loginResult.data.token);
            
            if (meResult.status === 200 && meResult.data.ok) {
                console.log('✅ /me endpoint works!');
                console.log(`   User: ${meResult.data.user.name} (${meResult.data.user.email})`);
            } else {
                console.log('❌ /me failed:', meResult.data);
            }
        } else {
            console.log('❌ Login failed:', loginResult.data);
        }
    } else {
        console.log('❌ Registration failed:', regResult.data);
    }

    console.log('\n🎉 Test completed!');
}

// Check if server is running
makeRequest('GET', '/api/auth').then(() => {
    runTests();
}).catch(err => {
    console.log('⚠️  Server not running. Start it with: npm run dev');
    console.log('Then run this test again.');
});
