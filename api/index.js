const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

// Mock auth and store functions for demo
const verifySession = async (sessionId) => {
    // In production, verify against your auth system
    return sessionId ? 'demo-user-123' : null;
};

const getJson = async (key) => {
    // Mock data structure
    const mockData = {
        'user:demo-user-123': {
            id: 'demo-user-123',
            name: 'Eric Henderson',
            email: 'erich@legacyshield.com',
            role: 'admin'
        },
        'clients:demo-user-123': [
            {
                id: '1',
                name: 'John Smith',
                email: 'john@example.com',
                phone: '+1 (555) 123-4567',
                company: 'Smith Corp',
                status: 'active',
                planCount: 2,
                lastActive: new Date().toISOString()
            },
            {
                id: '2',
                name: 'Sarah Johnson',
                email: 'sarah@example.com',
                phone: '+1 (555) 987-6543',
                company: 'Johnson LLC',
                status: 'active',
                planCount: 1,
                lastActive: new Date().toISOString()
            },
            {
                id: '3',
                name: 'Michael Brown',
                email: 'michael@example.com',
                phone: '+1 (555) 456-7890',
                company: 'Brown Enterprises',
                status: 'pending',
                planCount: 0,
                lastActive: new Date(Date.now() - 7*24*60*60*1000).toISOString()
            }
        ],
        'plans:demo-user-123': [
            {
                id: '1',
                clientId: '1',
                clientName: 'John Smith',
                name: 'Full Legacy Plan',
                type: 'premium',
                status: 'active',
                value: 250000,
                beneficiaries: ['Jane Smith', 'Michael Smith'],
                createdAt: new Date().toISOString()
            },
            {
                id: '2',
                clientId: '2',
                clientName: 'Sarah Johnson',
                name: 'Basic Legacy Plan',
                type: 'basic',
                status: 'active',
                value: 150000,
                beneficiaries: ['Robert Johnson'],
                createdAt: new Date(Date.now() - 2*24*60*60*1000).toISOString()
            }
        ],
        'invoices:demo-user-123': [
            {
                id: 'INV-001',
                clientId: '1',
                clientName: 'John Smith',
                amount: 2999.99,
                date: new Date().toISOString(),
                dueDate: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
                status: 'pending',
                description: 'Annual Legacy Plan Subscription'
            },
            {
                id: 'INV-002',
                clientId: '2',
                clientName: 'Sarah Johnson',
                amount: 1999.99,
                date: new Date(Date.now() - 15*24*60*60*1000).toISOString(),
                dueDate: new Date(Date.now() - 5*24*60*60*1000).toISOString(),
                status: 'overdue',
                description: 'Quarterly Maintenance Fee'
            },
            {
                id: 'INV-003',
                clientId: '1',
                clientName: 'John Smith',
                amount: 1500.00,
                date: new Date(Date.now() - 60*24*60*60*1000).toISOString(),
                dueDate: new Date(Date.now() - 30*24*60*60*1000).toISOString(),
                status: 'paid',
                description: 'Setup Fee'
            }
        ],
        'legacy:plan:demo-user-123': {
            accountHolder: "Eric Henderson",
            subscriptionTier: "Enterprise Platinum",
            subscriptionStatus: "active",
            renewalDate: "2026-12-31",
            documentsCount: 14,
            storageUsed: "2.4 GB",
            securityLevel: "A+",
            compliance: ["GDPR", "HIPAA", "SOC2"],
            lastBackup: new Date().toISOString()
        },
        'activity:demo-user-123': [
            {
                user: 'System',
                action: 'Dashboard initialized',
                type: 'login',
                timestamp: new Date().toISOString()
            },
            {
                user: 'Eric Henderson',
                action: 'Created client: John Smith',
                type: 'create',
                timestamp: new Date(Date.now() - 3600000).toISOString()
            },
            {
                user: 'System',
                action: 'Daily backup completed',
                type: 'update',
                timestamp: new Date(Date.now() - 7200000).toISOString()
            },
            {
                user: 'Sarah Johnson',
                action: 'Updated legacy plan details',
                type: 'update',
                timestamp: new Date(Date.now() - 86400000).toISOString()
            },
            {
                user: 'System',
                action: 'Security scan completed',
                type: 'update',
                timestamp: new Date(Date.now() - 172800000).toISOString()
            }
        ]
    };
    
    return mockData[key] || null;
};

const setJson = async (key, value) => {
    // In production, save to database
    console.log(`Setting ${key}:`, value);
    return true;
};

const app = express();

// Middleware - CORS configured for Vercel deployment
app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            'https://exposureshield.com',
            'https://www.exposureshield.com',
            'http://localhost:3000',
            'http://127.0.0.1:3000'
        ];
        
        if (allowedOrigins.includes(origin) || origin.includes('vercel.app')) {
            return callback(null, true);
        }
        
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(cookieParser());
app.use(express.json());

// Authentication middleware
const authenticate = async (req, res, next) => {
    const sessionId = req.cookies?.session || req.cookies?.sessionId;
    
    // For demo, create a session cookie if none exists
    if (!sessionId) {
        res.cookie('session', 'demo-session-123', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });
        req.userId = 'demo-user-123';
        return next();
    }
    
    const userId = await verifySession(sessionId);
    if (!userId) {
        return res.status(401).json({ ok: false, error: 'Invalid session' });
    }
    
    req.userId = userId;
    next();
};

// API Routes

// Legacy Plan API (your existing endpoint)
app.get('/api/legacy/get', authenticate, async (req, res) => {
    try {
        const key = `legacy:plan:${req.userId}`;
        const plan = await getJson(key);
        
        res.json({ 
            ok: true, 
            plan: plan || null,
            userId: req.userId 
        });
    } catch (error) {
        console.error('Legacy GET error:', error);
        res.status(500).json({ ok: false, error: 'Internal server error' });
    }
});

// Client Management APIs
app.get('/api/clients', authenticate, async (req, res) => {
    try {
        const key = `clients:${req.userId}`;
        let clients = await getJson(key) || [];
        
        // Filter based on query params
        if (req.query.search) {
            const search = req.query.search.toLowerCase();
            clients = clients.filter(c => 
                c.name.toLowerCase().includes(search) ||
                c.email.toLowerCase().includes(search) ||
                (c.company && c.company.toLowerCase().includes(search))
            );
        }
        
        // Count active clients
        const activeClients = clients.filter(c => c.status === 'active').length;
        
        res.json({ 
            ok: true, 
            data: clients,
            total: clients.length,
            active: activeClients
        });
    } catch (error) {
        console.error('Clients GET error:', error);
        res.status(500).json({ ok: false, error: 'Failed to fetch clients' });
    }
});

app.post('/api/clients', authenticate, async (req, res) => {
    try {
        const clientData = req.body;
        
        // Validate
        if (!clientData.name || !clientData.email) {
            return res.status(400).json({ ok: false, error: 'Name and email are required' });
        }
        
        const key = `clients:${req.userId}`;
        const clients = await getJson(key) || [];
        
        const newClient = {
            id: Date.now().toString(),
            ...clientData,
            status: 'active',
            planCount: 0,
            lastActive: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            createdBy: req.userId
        };
        
        clients.push(newClient);
        await setJson(key, clients);
        
        // Log activity
        await logActivity(req.userId, 'create', `Created client: ${clientData.name}`);
        
        res.json({ ok: true, data: newClient });
    } catch (error) {
        console.error('Clients POST error:', error);
        res.status(500).json({ ok: false, error: 'Failed to create client' });
    }
});

// Plan Management APIs
app.get('/api/plans', authenticate, async (req, res) => {
    try {
        const key = `plans:${req.userId}`;
        let plans = await getJson(key) || [];
        
        // Apply limit if specified
        if (req.query.limit) {
            plans = plans.slice(0, parseInt(req.query.limit));
        }
        
        // Count active plans
        const activePlans = plans.filter(p => p.status === 'active').length;
        
        res.json({ 
            ok: true, 
            data: plans,
            total: plans.length,
            active: activePlans
        });
    } catch (error) {
        console.error('Plans GET error:', error);
        res.status(500).json({ ok: false, error: 'Failed to fetch plans' });
    }
});

app.post('/api/plans', authenticate, async (req, res) => {
    try {
        const planData = req.body;
        
        // Validate
        if (!planData.clientId || !planData.name || !planData.type) {
            return res.status(400).json({ ok: false, error: 'Missing required fields' });
        }
        
        // Get client name
        const clientsKey = `clients:${req.userId}`;
        const clients = await getJson(clientsKey) || [];
        const client = clients.find(c => c.id === planData.clientId);
        
        const key = `plans:${req.userId}`;
        const plans = await getJson(key) || [];
        
        const newPlan = {
            id: Date.now().toString(),
            ...planData,
            clientName: client ? client.name : 'Unknown Client',
            status: 'active',
            createdAt: new Date().toISOString(),
            createdBy: req.userId
        };
        
        plans.push(newPlan);
        await setJson(key, plans);
        
        // Log activity
        await logActivity(req.userId, 'create', `Created plan: ${planData.name}`);
        
        res.json({ ok: true, data: newPlan });
    } catch (error) {
        console.error('Plans POST error:', error);
        res.status(500).json({ ok: false, error: 'Failed to create plan' });
    }
});

// Invoice Management APIs
app.get('/api/invoices', authenticate, async (req, res) => {
    try {
        const key = `invoices:${req.userId}`;
        let invoices = await getJson(key) || [];
        
        // Filter recent if requested
        if (req.query.recent) {
            invoices = invoices.slice(0, 5);
        }
        
        // Calculate revenue
        const revenue = invoices
            .filter(i => i.status === 'paid')
            .reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
        
        // Count by status
        const pending = invoices.filter(i => i.status === 'pending').length;
        const paid = invoices.filter(i => i.status === 'paid').length;
        const overdue = invoices.filter(i => i.status === 'overdue').length;
        
        res.json({ 
            ok: true, 
            data: invoices,
            total: invoices.length,
            pending,
            paid,
            overdue,
            revenue: revenue
        });
    } catch (error) {
        console.error('Invoices GET error:', error);
        res.status(500).json({ ok: false, error: 'Failed to fetch invoices' });
    }
});

app.post('/api/invoices', authenticate, async (req, res) => {
    try {
        const invoiceData = req.body;
        
        // Validate
        if (!invoiceData.clientId || !invoiceData.amount || !invoiceData.dueDate) {
            return res.status(400).json({ ok: false, error: 'Missing required fields' });
        }
        
        // Get client name
        const clientsKey = `clients:${req.userId}`;
        const clients = await getJson(clientsKey) || [];
        const client = clients.find(c => c.id === invoiceData.clientId);
        
        const key = `invoices:${req.userId}`;
        const invoices = await getJson(key) || [];
        
        const newInvoice = {
            id: String(invoices.length + 1).padStart(3, '0'),
            ...invoiceData,
            clientName: client ? client.name : 'Unknown Client',
            status: 'pending',
            date: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            createdBy: req.userId
        };
        
        invoices.push(newInvoice);
        await setJson(key, invoices);
        
        // Log activity
        await logActivity(req.userId, 'create', `Created invoice: INV-${newInvoice.id}`);
        
        res.json({ ok: true, data: newInvoice });
    } catch (error) {
        console.error('Invoices POST error:', error);
        res.status(500).json({ ok: false, error: 'Failed to create invoice' });
    }
});

// Activity Log API
app.get('/api/activity/recent', authenticate, async (req, res) => {
    try {
        const key = `activity:${req.userId}`;
        const activities = await getJson(key) || [];
        
        // Get recent activities (last 10)
        const recent = activities
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 10);
        
        res.json({ ok: true, data: recent });
    } catch (error) {
        console.error('Activity GET error:', error);
        res.status(500).json({ ok: false, error: 'Failed to fetch activity' });
    }
});

app.post('/api/activity/log', authenticate, async (req, res) => {
    try {
        const { action, type } = req.body;
        
        if (!action) {
            return res.status(400).json({ ok: false, error: 'Action is required' });
        }
        
        const key = `activity:${req.userId}`;
        const activities = await getJson(key) || [];
        
        activities.push({
            user: 'System',
            action: action,
            type: type || 'info',
            timestamp: new Date().toISOString(),
            ip: req.ip || '127.0.0.1'
        });
        
        // Keep only last 100 activities
        if (activities.length > 100) {
            activities.splice(0, activities.length - 100);
        }
        
        await setJson(key, activities);
        
        res.json({ ok: true, message: 'Activity logged' });
    } catch (error) {
        console.error('Activity POST error:', error);
        res.status(500).json({ ok: false, error: 'Failed to log activity' });
    }
});

// Audit API
app.get('/api/audit', authenticate, async (req, res) => {
    try {
        const key = `activity:${req.userId}`;
        const activities = await getJson(key) || [];
        
        // Return all activities for audit trail
        res.json({ 
            ok: true, 
            data: activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        });
    } catch (error) {
        console.error('Audit GET error:', error);
        res.status(500).json({ ok: false, error: 'Failed to fetch audit log' });
    }
});

app.post('/api/audit/run', authenticate, async (req, res) => {
    try {
        // Simulate audit process
        await logActivity(req.userId, 'audit', 'Security audit completed');
        
        res.json({ 
            ok: true, 
            message: 'Audit completed successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Audit POST error:', error);
        res.status(500).json({ ok: false, error: 'Failed to run audit' });
    }
});

// User Profile API
app.get('/api/user/profile', authenticate, async (req, res) => {
    try {
        const key = `user:${req.userId}`;
        const user = await getJson(key) || {
            id: req.userId,
            name: 'Eric Henderson',
            email: 'erich@legacyshield.com',
            role: 'admin',
            company: 'LegacyShield Inc.'
        };
        
        res.json({ ok: true, user });
    } catch (error) {
        console.error('User profile error:', error);
        res.status(500).json({ ok: false, error: 'Failed to fetch user profile' });
    }
});

// Search API
app.get('/api/search', authenticate, async (req, res) => {
    try {
        const query = req.query.q?.toLowerCase() || '';
        
        if (!query || query.length < 2) {
            return res.json({ 
                ok: true, 
                data: { clients: [], plans: [], invoices: [] }
            });
        }
        
        // Search across all data
        const [clients, plans, invoices] = await Promise.all([
            getJson(`clients:${req.userId}`) || [],
            getJson(`plans:${req.userId}`) || [],
            getJson(`invoices:${req.userId}`) || []
        ]);
        
        const results = {
            clients: clients.filter(c => 
                c.name.toLowerCase().includes(query) ||
                c.email.toLowerCase().includes(query) ||
                (c.company && c.company.toLowerCase().includes(query))
            ),
            plans: plans.filter(p => 
                p.name.toLowerCase().includes(query) ||
                (p.clientName && p.clientName.toLowerCase().includes(query))
            ),
            invoices: invoices.filter(i => 
                i.clientName.toLowerCase().includes(query) ||
                (i.description && i.description.toLowerCase().includes(query))
            )
        };
        
        res.json({ ok: true, data: results });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ ok: false, error: 'Search failed' });
    }
});

// Export API
app.get('/api/export/dashboard', authenticate, async (req, res) => {
    try {
        const [clients, plans, invoices, activity] = await Promise.all([
            getJson(`clients:${req.userId}`) || [],
            getJson(`plans:${req.userId}`) || [],
            getJson(`invoices:${req.userId}`) || [],
            getJson(`activity:${req.userId}`) || []
        ]);
        
        const exportData = {
            metadata: {
                exportedAt: new Date().toISOString(),
                userId: req.userId,
                counts: {
                    clients: clients.length,
                    plans: plans.length,
                    invoices: invoices.length,
                    activities: activity.length
                }
            },
            clients,
            plans,
            invoices,
            activity
        };
        
        res.json({ ok: true, data: exportData });
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ ok: false, error: 'Export failed' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        ok: true, 
        status: 'operational',
        timestamp: new Date().toISOString(),
        version: '3.2.1',
        environment: process.env.NODE_ENV || 'development'
    });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({ ok: false, error: 'API endpoint not found' });
});

// Helper function to log activity
async function logActivity(userId, type, action) {
    try {
        const key = `activity:${userId}`;
        const activities = await getJson(key) || [];
        
        activities.push({
            user: 'System',
            action: action,
            type: type,
            timestamp: new Date().toISOString(),
            ip: '127.0.0.1'
        });
        
        // Keep only last 100 activities
        if (activities.length > 100) {
            activities.splice(0, activities.length - 100);
        }
        
        await setJson(key, activities);
    } catch (error) {
        console.error('Failed to log activity:', error);
    }
}

// Export for Vercel
module.exports = app;