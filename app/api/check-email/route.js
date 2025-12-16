// app/api/check-email/route.js 
export async function GET(request) { 
    console.log("[API] /api/check-email called"); 
    const { searchParams } = new URL(request.url); 
    const email = searchParams.get("email"); 
    return new Response(JSON.stringify({email: email, test: "working"}), { 
        status: 200, headers: { "Content-Type": "application/json" } 
    }); 
} 
