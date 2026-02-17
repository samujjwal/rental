const testPassword = "Test123!@#";

const loginOwner = async () => {
  console.log("Testing owner login...");
  const response = await fetch("http://localhost:3010/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: "owner@test.com",
      password: testPassword,
    }),
  });
  
  const data = await response.json();
  console.log("Status:", response.status);
  console.log("Response:", JSON.stringify(data, null, 2));
};

loginOwner().catch(console.error);
