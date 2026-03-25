const BASE = process.env.API_BASE_URL || "http://localhost:8080";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  return { status: res.status, body: json };
}

describe("Gateway API integration", () => {
  let userId;
  let username;

  test("register and login", async () => {
    username = `student_${Date.now()}`;

    const register = await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `${username}@example.com`,
        username,
        fullName: "Student Test",
        password: "123456"
      })
    });

    expect([201, 409]).toContain(register.status);

    const login = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: username, password: "123456" })
    });

    expect(login.status).toBe(200);
    expect(login.body.user).toBeDefined();
    expect(login.body.accessToken).toBeDefined();
    userId = login.body.user.id;
  });

  test("search users", async () => {
    const res = await request("/api/users/search?q=ana", {
      headers: { "X-User-Id": String(userId) }
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  test("follow public user and create post", async () => {
    const follow = await request("/api/social/follow/4", {
      method: "POST",
      headers: { "X-User-Id": String(userId) }
    });

    expect([201, 202]).toContain(follow.status);

    const create = await request("/api/posts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": String(userId)
      },
      body: JSON.stringify({
        caption: "API integration post",
        media: [{ type: "image", sizeMb: 1.2, url: "https://example.com/p.jpg" }]
      })
    });

    expect(create.status).toBe(201);
    expect(create.body.id).toBeDefined();

    const postId = create.body.id;

    const like = await request(`/api/engagement/posts/${postId}/like`, {
      method: "POST",
      headers: { "X-User-Id": String(userId) }
    });
    expect(like.status).toBe(201);

    const comment = await request(`/api/engagement/posts/${postId}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": String(userId)
      },
      body: JSON.stringify({ text: "Odlican post" })
    });
    expect(comment.status).toBe(201);
  });

  test("feed endpoint", async () => {
    const res = await request("/api/feed", {
      headers: { "X-User-Id": String(userId) }
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });
});
