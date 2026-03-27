const http = require("http");
const { URL } = require("url");

const PORT = 8081;

let userSeq = 13;
let postSeq = 1;
let storySeq = 1;
let commentSeq = 1;
let storyCommentSeq = 1;
let notifSeq = 1;

const initialUsers = [
  { id: 4, email: "milica@example.com", username: "milica", password: "123456", full_name: "Milica Kostic", is_private: false, bio: "Travel and photo lover", avatar_url: "http://localhost:3000/assets/milica.png" },
  { id: 5, email: "tamara@example.com", username: "tamara", password: "123456", full_name: "Tamara Majdak", is_private: true, bio: "Gym and wellness", avatar_url: "http://localhost:3000/assets/tamara.jpeg" },
  { id: 6, email: "aleksandra@example.com", username: "aleksandra", password: "123456", full_name: "Aleksandra Acimovic", is_private: false, bio: "Reels and lifestyle", avatar_url: "http://localhost:3000/assets/aleksandra.jpeg" },
  { id: 7, email: "natalija@example.com", username: "natalija", password: "123456", full_name: "Natalija Ristovic", is_private: false, bio: "Photography and fashion", avatar_url: "http://localhost:3000/assets/natalija.jpeg" },
  { id: 8, email: "marija@example.com", username: "marija", password: "123456", full_name: "Marija Stevic", is_private: false, bio: "Beauty and daily moments", avatar_url: "http://localhost:3000/assets/marija.jpeg" },
  { id: 9, email: "teodora@example.com", username: "teodora", password: "123456", full_name: "Teodora Ilic", is_private: false, bio: "Cafe hopping and outfits", avatar_url: "" },
  { id: 10, email: "jelena@example.com", username: "jelena", password: "123456", full_name: "Jelena Petrovic", is_private: false, bio: "Weekend travel diary", avatar_url: "" },
  { id: 11, email: "andjela@example.com", username: "andjela", password: "123456", full_name: "Andjela Nikolic", is_private: true, bio: "Private moments and close friends", avatar_url: "" },
  { id: 12, email: "nikolina@example.com", username: "nikolina", password: "123456", full_name: "Nikolina Savic", is_private: false, bio: "Music, reels and city nights", avatar_url: "" }
];
let users = initialUsers.map((u) => ({ ...u }));

const follows = new Map(); // key: follower:following => status accepted|pending
const blocks = new Set(); // blocker:blocked
const posts = [];
const stories = [];
const likes = new Set(); // user:post
const storyLikes = new Set(); // user:story
const comments = [];
const storyComments = [];
const notifications = [];

function json(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id"
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", c => body += c);
    req.on("end", () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

function meId(req, url) {
  return Number(req.headers["x-user-id"] || url.searchParams.get("me") || 1);
}

function findUserByLogin(login) {
  const s = String(login || "").trim().toLowerCase();
  return users.find(u => u.email.toLowerCase() === s || u.username.toLowerCase() === s);
}

function isBlocked(a, b) {
  return blocks.has(`${a}:${b}`) || blocks.has(`${b}:${a}`);
}

function canSeeUser(viewerId, targetId) {
  if (isBlocked(viewerId, targetId)) return false;
  const target = users.find(u => u.id === targetId);
  if (!target) return false;
  if (!target.is_private || viewerId === targetId) return true;
  return follows.get(`${viewerId}:${targetId}`) === "accepted";
}


function pushNotification(userId, type, text) {
  notifications.push({
    id: notifSeq++,
    userId,
    type,
    text,
    read: false,
    createdAt: new Date().toISOString()
  });
}

function nowIso() {
  return new Date().toISOString();
}

function purgeExpiredStories() {
  const now = Date.now();
  for (let i = stories.length - 1; i >= 0; i -= 1) {
    if (new Date(stories[i].expiresAt).getTime() <= now) {
      const storyId = stories[i].id;
      stories.splice(i, 1);
      for (const key of Array.from(storyLikes)) {
        if (Number(String(key).split(":")[1]) === storyId) storyLikes.delete(key);
      }
      for (let j = storyComments.length - 1; j >= 0; j -= 1) {
        if (storyComments[j].storyId === storyId) storyComments.splice(j, 1);
      }
    }
  }
}

function activeStories() {
  purgeExpiredStories();
  return stories.slice();
}

function resetState() {
  userSeq = 13;
  postSeq = 1;
  storySeq = 1;
  commentSeq = 1;
  storyCommentSeq = 1;
  notifSeq = 1;

  users.splice(0, users.length, ...initialUsers.map((u) => ({ ...u })));
  follows.clear();
  blocks.clear();
  posts.splice(0, posts.length);
  stories.splice(0, stories.length);
  likes.clear();
  storyLikes.clear();
  comments.splice(0, comments.length);
  storyComments.splice(0, storyComments.length);
  notifications.splice(0, notifications.length);
}
function makePostView(p) {
  const likesCount = Array.from(likes).filter(x => Number(x.split(":")[1]) === p.id).length;
  const commentsCount = comments.filter(c => c.postId === p.id).length;
  return { ...p, likesCount, commentsCount };
}

function makeStoryView(s) {
  const likesCount = Array.from(storyLikes).filter(x => Number(x.split(":")[1]) === s.id).length;
  const commentsCount = storyComments.filter(c => c.storyId === s.id).length;
  const remainingMs = Math.max(0, new Date(s.expiresAt).getTime() - Date.now());
  return { ...s, story_kind: s.story_kind || "story", likesCount, commentsCount, remainingMinutes: Math.ceil(remainingMs / 60000) };
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return json(res, 200, { ok: true });
  const url = new URL(req.url, "http://localhost");

  try {
    if (req.method === "GET" && url.pathname === "/health") return json(res, 200, { status: "ok", mode: "quickstart-mock" });

    if (req.method === "POST" && url.pathname === "/api/dev/reset") {
      resetState();
      return json(res, 200, { ok: true, message: "State resetovan" });
    }

    if (req.method === "POST" && url.pathname === "/api/dev/seed") {
      const viewerId = meId(req, url);
      const viewer = users.find((u) => u.id === viewerId) || users[0];

      const preferredOrder = ["milica", "tamara", "aleksandra", "natalija", "marija"];
      const preferredOthers = preferredOrder
        .map((username) => users.find((u) => u.username === username && u.id !== viewer.id))
        .filter(Boolean);
      const others = preferredOthers.length ? preferredOthers : users.filter((u) => u.id !== viewer.id);
      const target = others[0] || users[0];
      const third = others[1] || target;

      [target.id, third.id].forEach((id) => {
        follows.set(`${viewer.id}:${id}`, "accepted");
        follows.set(`${id}:${viewer.id}`, "accepted");
      });

      const now = Date.now();
      const samplePosts = [
        {
          authorId: viewer.id,
          caption: "Morning coffee and planning the day",
          media: [
            { id: 1, media_type: "image", media_url: "https://picsum.photos/seed/milica-a1/1080/1080", size_bytes: 2 * 1024 * 1024, position: 0 }
          ],
          createdAt: new Date(now - 7 * 60 * 60 * 1000).toISOString()
        },
        {
          authorId: viewer.id,
          caption: "Reel from daily routine",
          media: [
            { id: 1, media_type: "video", media_url: "https://samplelib.com/lib/preview/mp4/sample-20s.mp4", size_bytes: 8 * 1024 * 1024, position: 0 }
          ],
          createdAt: new Date(now - 6 * 60 * 60 * 1000).toISOString()
        },
        {
          authorId: target.id,
          caption: "City lights and night walk",
          media: [
            { id: 1, media_type: "image", media_url: "https://picsum.photos/seed/milica-b1/1080/1080", size_bytes: 2 * 1024 * 1024, position: 0 },
            { id: 2, media_type: "image", media_url: "https://picsum.photos/seed/milica-b2/1080/1080", size_bytes: 2 * 1024 * 1024, position: 1 }
          ],
          createdAt: new Date(now - 5 * 60 * 60 * 1000).toISOString()
        },
        {
          authorId: target.id,
          caption: "Gym reel progress check",
          media: [
            { id: 1, media_type: "video", media_url: "https://samplelib.com/lib/preview/mp4/sample-30s.mp4", size_bytes: 11 * 1024 * 1024, position: 0 }
          ],
          createdAt: new Date(now - 4 * 60 * 60 * 1000).toISOString()
        },
        {
          authorId: third.id,
          caption: "Outfit and weekend mood",
          media: [
            { id: 1, media_type: "image", media_url: "https://picsum.photos/seed/milica-c1/1080/1080", size_bytes: 2 * 1024 * 1024, position: 0 }
          ],
          createdAt: new Date(now - 3 * 60 * 60 * 1000).toISOString()
        },
        {
          authorId: third.id,
          caption: "Reel from downtown",
          media: [
            { id: 1, media_type: "video", media_url: "https://filesamples.com/samples/video/mp4/sample_960x400_ocean_with_audio.mp4", size_bytes: 13 * 1024 * 1024, position: 0 }
          ],
          createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString()
        },
        {
          authorId: viewer.id,
          caption: "Profile redesign draft",
          media: [
            { id: 1, media_type: "image", media_url: "https://picsum.photos/seed/milica-d1/1080/1080", size_bytes: 2 * 1024 * 1024, position: 0 }
          ],
          createdAt: new Date(now - 1 * 60 * 60 * 1000).toISOString()
        }
      ];

      const createdIds = [];
      samplePosts.forEach((sp) => {
        const post = {
          id: postSeq++,
          authorId: sp.authorId,
          caption: sp.caption,
          media: sp.media,
          createdAt: sp.createdAt,
          updatedAt: sp.createdAt
        };
        posts.push(post);
        createdIds.push(post.id);
      });

      [target, third].forEach((user) => {
        posts.filter((p) => p.authorId === user.id).slice(0, 2).forEach((p) => {
          likes.add(`${viewer.id}:${p.id}`);
          comments.push({
            id: commentSeq++,
            postId: p.id,
            authorId: viewer.id,
            text: "Odlicna objava!",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          pushNotification(user.id, "new_like", `@${viewer.username} je lajkovao tvoju objavu #${p.id}`);
          pushNotification(user.id, "new_comment", `@${viewer.username} je komentarisao tvoju objavu #${p.id}`);
        });
      });

      posts.filter((p) => p.authorId === viewer.id).slice(0, 2).forEach((p) => {
        likes.add(`${target.id}:${p.id}`);
        comments.push({
          id: commentSeq++,
          postId: p.id,
          authorId: target.id,
          text: "Brutalno izgleda",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        pushNotification(viewer.id, "new_like", `@${target.username} je lajkovao tvoju objavu #${p.id}`);
        pushNotification(viewer.id, "new_comment", `@${target.username} je komentarisao tvoju objavu #${p.id}`);
      });

      const aleksandraStoryUser = users.find((u) => u.username === "aleksandra") || target;
      const marijaStoryUser = users.find((u) => u.username === "marija") || third;

      const sampleStories = [
        {
          authorId: target.id,
          media_type: "image",
          media_url: "https://picsum.photos/seed/story-target-1/1080/1920",
          durationMinutes: 90,
          caption: "Story iz centra grada",
          story_kind: "story",
          createdAt: new Date(now - 25 * 60 * 1000).toISOString()
        },
        {
          authorId: target.id,
          media_type: "video",
          media_url: "https://samplelib.com/lib/preview/mp4/sample-20s.mp4",
          durationMinutes: 120,
          caption: "Kratki video story",
          story_kind: "story",
          createdAt: new Date(now - 20 * 60 * 1000).toISOString()
        },
        {
          authorId: target.id,
          media_type: "image",
          media_url: "https://picsum.photos/seed/story-target-2/1080/1920",
          durationMinutes: 75,
          caption: "Kafa i jutarnji vibe",
          story_kind: "highlight",
          createdAt: new Date(now - 16 * 60 * 1000).toISOString()
        },
        {
          authorId: target.id,
          media_type: "image",
          media_url: "https://picsum.photos/seed/story-target-3/1080/1920",
          durationMinutes: 50,
          caption: "Fit check pre izlaska",
          story_kind: "highlight",
          createdAt: new Date(now - 11 * 60 * 1000).toISOString()
        },
        {
          authorId: target.id,
          media_type: "video",
          media_url: "https://samplelib.com/lib/preview/mp4/sample-30s.mp4",
          durationMinutes: 45,
          caption: "Mini reel u story formatu",
          story_kind: "story",
          createdAt: new Date(now - 7 * 60 * 1000).toISOString()
        },
        {
          authorId: third.id,
          media_type: "image",
          media_url: "https://picsum.photos/seed/story-third-1/1080/1920",
          durationMinutes: 60,
          caption: "Popodnevni story",
          story_kind: "story",
          createdAt: new Date(now - 18 * 60 * 1000).toISOString()
        },
        {
          authorId: third.id,
          media_type: "image",
          media_url: "https://picsum.photos/seed/story-third-2/1080/1920",
          durationMinutes: 55,
          caption: "Backstage detalj",
          story_kind: "highlight",
          createdAt: new Date(now - 13 * 60 * 1000).toISOString()
        },
        {
          authorId: third.id,
          media_type: "video",
          media_url: "https://filesamples.com/samples/video/mp4/sample_960x400_ocean_with_audio.mp4",
          durationMinutes: 40,
          caption: "Vecernji story video",
          story_kind: "story",
          createdAt: new Date(now - 8 * 60 * 1000).toISOString()
        },
        {
          authorId: aleksandraStoryUser.id,
          media_type: "image",
          media_url: "https://picsum.photos/seed/story-aleksandra-1/1080/1920",
          durationMinutes: 70,
          caption: "Mirror selfie pre izlaska",
          story_kind: "story",
          createdAt: new Date(now - 17 * 60 * 1000).toISOString()
        },
        {
          authorId: aleksandraStoryUser.id,
          media_type: "video",
          media_url: "https://samplelib.com/lib/preview/mp4/sample-15s.mp4",
          durationMinutes: 35,
          caption: "Brzi story update",
          story_kind: "highlight",
          createdAt: new Date(now - 6 * 60 * 1000).toISOString()
        },
        {
          authorId: marijaStoryUser.id,
          media_type: "image",
          media_url: "https://picsum.photos/seed/story-marija-1/1080/1920",
          durationMinutes: 80,
          caption: "Beauty corner",
          story_kind: "highlight",
          createdAt: new Date(now - 21 * 60 * 1000).toISOString()
        },
        {
          authorId: marijaStoryUser.id,
          media_type: "image",
          media_url: "https://picsum.photos/seed/story-marija-2/1080/1920",
          durationMinutes: 50,
          caption: "Novi highlight trenutak",
          story_kind: "highlight",
          createdAt: new Date(now - 9 * 60 * 1000).toISOString()
        }
      ];

      sampleStories.forEach((ss) => {
        const createdAt = new Date(ss.createdAt);
        stories.push({
          id: storySeq++,
          authorId: ss.authorId,
          media_type: ss.media_type,
          media_url: ss.media_url,
          caption: ss.caption,
          durationMinutes: ss.durationMinutes,
          createdAt: createdAt.toISOString(),
          expiresAt: new Date(createdAt.getTime() + ss.durationMinutes * 60000).toISOString()
        });
      });

      return json(res, 200, { ok: true, seededPostIds: createdIds, totalPosts: createdIds.length });
    }

    // auth
    if (req.method === "POST" && url.pathname === "/api/auth/register") {
      const body = await readBody(req);
      const email = String(body.email || "").trim().toLowerCase();
      const username = String(body.username || "").trim().toLowerCase();
      const password = String(body.password || "");
      const fullName = String(body.fullName || username || "User").trim();

      if (!email || !username || password.length < 6) return json(res, 400, { error: "Potrebni su email, username i lozinka >= 6" });
      if (users.some(u => u.email === email || u.username === username)) return json(res, 409, { error: "Korisnik vec postoji" });

      const user = { id: userSeq++, email, username, password, full_name: fullName, is_private: false, bio: "", avatar_url: "" };
      users.push(user);
      return json(res, 201, { user: { id: user.id, email, username }, accessToken: `mock-access-${user.id}`, refreshToken: `mock-refresh-${user.id}` });
    }

    if (req.method === "POST" && url.pathname === "/api/auth/login") {
      const body = await readBody(req);
      const u = findUserByLogin(body.login);
      if (!u || u.password !== String(body.password || "")) return json(res, 401, { error: "Pogresni kredencijali" });
      return json(res, 200, { user: { id: u.id, email: u.email, username: u.username }, accessToken: `mock-access-${u.id}`, refreshToken: `mock-refresh-${u.id}` });
    }

    if (req.method === "POST" && url.pathname === "/api/auth/refresh") return json(res, 200, { accessToken: "mock-access-refreshed", refreshToken: "mock-refresh-refreshed" });
    if (req.method === "POST" && url.pathname === "/api/auth/logout") return json(res, 200, { message: "Odjavljen" });

    // users
    if (req.method === "GET" && url.pathname === "/api/users/me") {
      const id = meId(req, url);
      const u = users.find(x => x.id === id);
      if (!u) return json(res, 404, { error: "Korisnik nije pronadjen" });
      return json(res, 200, u);
    }

    if (req.method === "PATCH" && url.pathname === "/api/users/me") {
      const id = meId(req, url);
      const u = users.find(x => x.id === id);
      if (!u) return json(res, 404, { error: "Korisnik nije pronadjen" });
      const body = await readBody(req);
      if (body.fullName != null) u.full_name = String(body.fullName);
      if (body.bio != null) u.bio = String(body.bio);
      if (body.avatarUrl != null) u.avatar_url = String(body.avatarUrl);
      if (typeof body.isPrivate === "boolean") u.is_private = body.isPrivate;
      return json(res, 200, u);
    }

    if (req.method === "GET" && url.pathname === "/api/users/search") {
      const q = String(url.searchParams.get("q") || "").toLowerCase();
      const viewerId = meId(req, url);
      const items = users.filter(u => u.id !== viewerId && !isBlocked(viewerId, u.id) && (u.username.includes(q) || u.full_name.toLowerCase().includes(q)));
      return json(res, 200, { items });
    }

    const userByUsername = url.pathname.match(/^\/api\/users\/([a-zA-Z0-9_\-.]+)$/);
    if (req.method === "GET" && userByUsername) {
      const viewerId = meId(req, url);
      const u = users.find(x => x.username === userByUsername[1].toLowerCase());
      if (!u) return json(res, 404, { error: "Profil nije pronadjen" });
      if (isBlocked(viewerId, u.id)) return json(res, 403, { error: "Pristup profilu nije dozvoljen" });
      return json(res, 200, u);
    }

    const userBlock = url.pathname.match(/^\/api\/users\/(\d+)\/block$/);
    if (userBlock) {
      const targetId = Number(userBlock[1]);
      const viewerId = meId(req, url);
      if (req.method === "POST") {
        blocks.add(`${viewerId}:${targetId}`);
        follows.delete(`${viewerId}:${targetId}`);
        follows.delete(`${targetId}:${viewerId}`);
        return json(res, 201, { blocked: true, blockerId: viewerId, targetId });
      }
      if (req.method === "DELETE") {
        blocks.delete(`${viewerId}:${targetId}`);
        return json(res, 200, { blocked: false, blockerId: viewerId, targetId });
      }
    }

    // social
    const followMatch = url.pathname.match(/^\/api\/social\/follow\/(\d+)$/);
    if (followMatch) {
      const targetId = Number(followMatch[1]);
      const viewerId = meId(req, url);
      if (targetId === viewerId) return json(res, 400, { error: "Ne mozes pratiti sebe" });
      if (isBlocked(viewerId, targetId)) return json(res, 403, { error: "Follow nije dozvoljen zbog blokiranja" });
      const target = users.find(u => u.id === targetId);
      if (!target) return json(res, 404, { error: "Target profil ne postoji" });

      if (req.method === "POST") {
        const status = target.is_private ? "pending" : "accepted";
        follows.set(`${viewerId}:${targetId}`, status);
        if (status === "pending") {
          pushNotification(
            targetId,
            "follow_request",
            `@${users.find(u => u.id === viewerId)?.username || viewerId} ti je poslao zahtev za pracenje`
          );
          return json(res, 202, { status, followerId: viewerId, followingId: targetId });
        }
        pushNotification(
          targetId,
          "new_follower",
          `@${users.find(u => u.id === viewerId)?.username || viewerId} te sada prati`
        );
        return json(res, 201, { status, followerId: viewerId, followingId: targetId });
      }

      if (req.method === "DELETE") {
        follows.delete(`${viewerId}:${targetId}`);
        return json(res, 200, { status: "unfollowed", followerId: viewerId, followingId: targetId });
      }
    }

    if (req.method === "GET" && url.pathname === "/api/social/requests") {
      const viewerId = meId(req, url);
      const items = [];
      for (const [k, status] of follows.entries()) {
        if (status !== "pending") continue;
        const [followerId, followingId] = k.split(":").map(Number);
        if (followingId !== viewerId) continue;
        const follower = users.find(u => u.id === followerId);
        items.push({ follower_id: followerId, follower_username: follower?.username || "unknown", following_id: followingId });
      }
      return json(res, 200, { items });
    }

    const reqDecision = url.pathname.match(/^\/api\/social\/requests\/(\d+)\/(accept|reject)$/);
    if (reqDecision && req.method === "POST") {
      const followerId = Number(reqDecision[1]);
      const action = reqDecision[2];
      const viewerId = meId(req, url);
      const key = `${followerId}:${viewerId}`;
      if (!follows.has(key) || follows.get(key) !== "pending") return json(res, 404, { error: "Pending zahtev nije pronadjen" });
      follows.set(key, action === "accept" ? "accepted" : "rejected");
      if (action === "accept") {
        pushNotification(
          followerId,
          "request_accepted",
          `@${users.find(u => u.id === viewerId)?.username || viewerId} je prihvatio tvoj zahtev`
        );
      }
      return json(res, 200, { followerId, followingId: viewerId, status: follows.get(key) });
    }

    const statsMatch = url.pathname.match(/^\/api\/social\/stats\/(\d+)$/);
    if (statsMatch && req.method === "GET") {
      const userId = Number(statsMatch[1]);
      let followersCount = 0;
      let followingCount = 0;
      for (const [k, status] of follows.entries()) {
        if (status !== "accepted") continue;
        const [followerId, followingId] = k.split(":").map(Number);
        if (followingId === userId) followersCount += 1;
        if (followerId === userId) followingCount += 1;
      }
      return json(res, 200, { userId, followersCount, followingCount });
    }


    const followersListMatch = url.pathname.match(/^\/api\/social\/followers\/(\d+)$/);
    if (followersListMatch && req.method === "GET") {
      const userId = Number(followersListMatch[1]);
      const items = [];
      for (const [k, status] of follows.entries()) {
        if (status !== "accepted") continue;
        const [followerId, followingId] = k.split(":").map(Number);
        if (followingId !== userId) continue;
        const u = users.find(x => x.id === followerId);
        if (u) items.push({ id: u.id, username: u.username, full_name: u.full_name });
      }
      return json(res, 200, { items });
    }

    const followingListMatch = url.pathname.match(/^\/api\/social\/following\/(\d+)$/);
    if (followingListMatch && req.method === "GET") {
      const userId = Number(followingListMatch[1]);
      const items = [];
      for (const [k, status] of follows.entries()) {
        if (status !== "accepted") continue;
        const [followerId, followingId] = k.split(":").map(Number);
        if (followerId !== userId) continue;
        const u = users.find(x => x.id === followingId);
        if (u) items.push({ id: u.id, username: u.username, full_name: u.full_name });
      }
      return json(res, 200, { items });
    }

    if (req.method === "GET" && url.pathname === "/api/notifications") {
      const viewerId = meId(req, url);
      const items = notifications
        .filter(n => n.userId === viewerId)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      return json(res, 200, { items, unreadCount: items.filter(i => !i.read).length });
    }

    const readOneMatch = url.pathname.match(/^\/api\/notifications\/(\d+)\/read$/);
    if (readOneMatch && req.method === "POST") {
      const viewerId = meId(req, url);
      const notifId = Number(readOneMatch[1]);
      const n = notifications.find((x) => x.id === notifId && x.userId === viewerId);
      if (!n) return json(res, 404, { error: "Notifikacija nije pronadjena" });
      n.read = true;
      return json(res, 200, { ok: true, id: notifId });
    }

    if (req.method === "POST" && url.pathname === "/api/notifications/read-all") {
      const viewerId = meId(req, url);
      notifications.forEach((n) => {
        if (n.userId === viewerId) n.read = true;
      });
      return json(res, 200, { ok: true });
    }
    if (req.method === "GET" && url.pathname === "/api/export/state") {
      const viewerId = meId(req, url);
      purgeExpiredStories();
      const snapshot = {
        generatedAt: new Date().toISOString(),
        viewerId,
        users,
        follows: Array.from(follows.entries()).map(([key, status]) => ({ key, status })),
        blocks: Array.from(blocks.values()),
        posts,
        stories,
        likes: Array.from(likes.values()),
        storyLikes: Array.from(storyLikes.values()),
        comments,
        storyComments,
        notifications: notifications.filter(n => n.userId === viewerId)
      };
      return json(res, 200, snapshot);
    }
    // stories
    if (req.method === "POST" && url.pathname === "/api/stories") {
      const viewerId = meId(req, url);
      const body = await readBody(req);
      const mediaType = String(body.type || body.mediaType || "").toLowerCase();
      const mediaUrl = String(body.url || body.mediaUrl || "").trim();
      const durationMinutes = Number(body.durationMinutes || body.duration || 0);
      const caption = String(body.caption || "");
      if (!["image", "video"].includes(mediaType)) return json(res, 400, { error: "Story mora biti image ili video" });
      if (!mediaUrl) return json(res, 400, { error: "Story mora imati media URL" });
      if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return json(res, 400, { error: "Trajanje price mora biti pozitivan broj minuta" });
      purgeExpiredStories();
      const activeMine = stories.filter((s) => s.authorId === viewerId);
      if (activeMine.length >= 5) return json(res, 400, { error: "Dozvoljeno je maksimalno 5 aktivnih story stavki" });
      const createdAt = new Date();
      const story = {
        id: storySeq++,
        authorId: viewerId,
        media_type: mediaType,
        media_url: mediaUrl,
        caption,
        durationMinutes,
        createdAt: createdAt.toISOString(),
        expiresAt: new Date(createdAt.getTime() + durationMinutes * 60000).toISOString()
      };
      stories.push(story);
      return json(res, 201, makeStoryView(story));
    }

    if (req.method === "GET" && url.pathname === "/api/stories/feed") {
      const viewerId = meId(req, url);
      const followingAccepted = Array.from(follows.entries())
        .filter(([k, status]) => status === "accepted" && Number(k.split(":")[0]) === viewerId)
        .map(([k]) => Number(k.split(":")[1]));
      const items = activeStories()
        .filter((s) => followingAccepted.includes(s.authorId) && !isBlocked(viewerId, s.authorId))
        .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
        .map((s) => {
          const author = users.find((u) => u.id === s.authorId);
          return {
            ...makeStoryView(s),
            authorUsername: author?.username || "unknown",
            authorFullName: author?.full_name || "",
            authorAvatarUrl: author?.avatar_url || ""
          };
        });
      return json(res, 200, { items });
    }

    if (req.method === "GET" && url.pathname === "/api/stories") {
      const viewerId = meId(req, url);
      const authorId = Number(url.searchParams.get("authorId") || 0);
      let list = activeStories();
      if (authorId > 0) list = list.filter((s) => s.authorId === authorId);
      list = list.filter((s) => canSeeUser(viewerId, s.authorId));
      return json(res, 200, {
        items: list
          .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
          .map((s) => {
            const author = users.find((u) => u.id === s.authorId);
            return {
              ...makeStoryView(s),
              authorUsername: author?.username || "unknown",
              authorFullName: author?.full_name || "",
              authorAvatarUrl: author?.avatar_url || ""
            };
          })
      });
    }

    const storyById = url.pathname.match(/^\/api\/stories\/(\d+)$/);
    if (storyById) {
      const id = Number(storyById[1]);
      const viewerId = meId(req, url);
      const story = activeStories().find((x) => x.id === id);
      if (!story) return json(res, 404, { error: "Story nije pronadjen ili je istekao" });
      if (!canSeeUser(viewerId, story.authorId)) return json(res, 403, { error: "Nemate pristup ovom story-ju" });
      if (req.method === "GET") {
        const author = users.find((u) => u.id === story.authorId);
        return json(res, 200, {
          ...makeStoryView(story),
          authorUsername: author?.username || "unknown",
          authorFullName: author?.full_name || "",
          authorAvatarUrl: author?.avatar_url || ""
        });
      }
      if (req.method === "DELETE") {
        if (story.authorId !== viewerId) return json(res, 403, { error: "Samo autor brise story" });
        const idx = stories.findIndex((x) => x.id === id);
        if (idx >= 0) stories.splice(idx, 1);
        for (const key of Array.from(storyLikes)) {
          if (Number(String(key).split(":")[1]) === id) storyLikes.delete(key);
        }
        for (let j = storyComments.length - 1; j >= 0; j -= 1) {
          if (storyComments[j].storyId === id) storyComments.splice(j, 1);
        }
        return json(res, 200, { deleted: true, storyId: id });
      }
    }
    // posts
    if (req.method === "POST" && url.pathname === "/api/posts") {
      const viewerId = meId(req, url);
      const body = await readBody(req);
      const media = Array.isArray(body.media) ? body.media : [];
      if (media.length < 1) return json(res, 400, { error: "Objava mora imati bar jedan media element" });
      if (media.length > 20) return json(res, 400, { error: "Maksimalno 20 media elemenata" });
      for (const m of media) {
        const t = String(m.type || "").toLowerCase();
        if (!["image", "video"].includes(t)) return json(res, 400, { error: "Dozvoljen je samo image/video" });
        if (Number(m.sizeMb || 0) <= 0 || Number(m.sizeMb || 0) > 50) return json(res, 400, { error: "Maksimalna velicina fajla je 50MB" });
      }
      const post = {
        id: postSeq++,
        authorId: viewerId,
        caption: String(body.caption || ""),
        media: media.map((m, i) => ({ id: i + 1, media_type: String(m.type).toLowerCase(), media_url: String(m.url || `mock://${Date.now()}`), size_bytes: Math.round(Number(m.sizeMb || 0) * 1024 * 1024), position: i })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      posts.push(post);
      return json(res, 201, makePostView(post));
    }

    if (req.method === "GET" && url.pathname === "/api/posts") {
      const viewerId = meId(req, url);
      const authorId = Number(url.searchParams.get("authorId") || 0);
      let list = posts;
      if (authorId > 0) list = list.filter(p => p.authorId === authorId);
      const items = list.filter(p => canSeeUser(viewerId, p.authorId)).map(makePostView);
      return json(res, 200, { items });
    }

    const postById = url.pathname.match(/^\/api\/posts\/(\d+)$/);
    if (postById) {
      const id = Number(postById[1]);
      const viewerId = meId(req, url);
      const p = posts.find(x => x.id === id);
      if (!p) return json(res, 404, { error: "Objava nije pronadjena" });
      if (!canSeeUser(viewerId, p.authorId)) return json(res, 403, { error: "Nemate pristup ovoj objavi" });

      if (req.method === "GET") return json(res, 200, makePostView(p));
      if (req.method === "PATCH") {
        if (p.authorId !== viewerId) return json(res, 403, { error: "Samo autor menja objavu" });
        const body = await readBody(req);
        p.caption = String(body.caption || "");
        p.updatedAt = new Date().toISOString();
        return json(res, 200, makePostView(p));
      }
      if (req.method === "DELETE") {
        if (p.authorId !== viewerId) return json(res, 403, { error: "Samo autor brise objavu" });
        const i = posts.findIndex(x => x.id === id);
        posts.splice(i, 1);
        return json(res, 200, { deleted: true, postId: id });
      }
    }

    const deleteMedia = url.pathname.match(/^\/api\/posts\/(\d+)\/media\/(\d+)$/);
    if (deleteMedia && req.method === "DELETE") {
      const postId = Number(deleteMedia[1]);
      const mediaId = Number(deleteMedia[2]);
      const viewerId = meId(req, url);
      const p = posts.find(x => x.id === postId);
      if (!p) return json(res, 404, { error: "Objava nije pronadjena" });
      if (p.authorId !== viewerId) return json(res, 403, { error: "Samo autor menja mediju" });
      const idx = p.media.findIndex(m => m.id === mediaId);
      if (idx < 0) return json(res, 404, { error: "Media nije pronadjena" });
      p.media.splice(idx, 1);
      p.updatedAt = new Date().toISOString();
      return json(res, 200, makePostView(p));
    }

    // engagement
    const likeRoute = url.pathname.match(/^\/api\/engagement\/posts\/(\d+)\/like$/);
    if (likeRoute) {
      const postId = Number(likeRoute[1]);
      const viewerId = meId(req, url);
      const p = posts.find(x => x.id === postId);
      if (!p) return json(res, 404, { error: "Objava nije pronadjena" });
      if (!canSeeUser(viewerId, p.authorId)) return json(res, 403, { error: "Nemate dozvolu za ovu akciju" });
      const key = `${viewerId}:${postId}`;
      if (req.method === "POST") {
        likes.add(key);
        if (p.authorId !== viewerId) {
          pushNotification(
            p.authorId,
            "new_like",
            `@${users.find(u => u.id === viewerId)?.username || viewerId} je lajkovao tvoju objavu #${postId}`
          );
        }
        return json(res, 201, { liked: true, postId, meId: viewerId, likesCount: Array.from(likes).filter(k => Number(k.split(":")[1]) === postId).length });
      }
      if (req.method === "DELETE") {
        likes.delete(key);
        return json(res, 200, { liked: false, postId, meId: viewerId, likesCount: Array.from(likes).filter(k => Number(k.split(":")[1]) === postId).length });
      }
    }

    const commentsRoute = url.pathname.match(/^\/api\/engagement\/posts\/(\d+)\/comments$/);
    if (commentsRoute) {
      const postId = Number(commentsRoute[1]);
      const viewerId = meId(req, url);
      const p = posts.find(x => x.id === postId);
      if (!p) return json(res, 404, { error: "Objava nije pronadjena" });
      if (!canSeeUser(viewerId, p.authorId)) return json(res, 403, { error: "Nemate dozvolu za ovu akciju" });

            if (req.method === "GET") {
        const items = comments
          .filter(c => c.postId === postId)
          .map(c => ({ ...c, authorUsername: users.find(u => u.id === c.authorId)?.username || "unknown" }));
        return json(res, 200, { items });
      }
      if (req.method === "POST") {
        const body = await readBody(req);
        const text = String(body.text || "").trim();
        if (!text) return json(res, 400, { error: "text je obavezan" });
        const c = { id: commentSeq++, postId, authorId: viewerId, text, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        comments.push(c);
        if (p.authorId !== viewerId) {
          pushNotification(
            p.authorId,
            "new_comment",
            `@${users.find(u => u.id === viewerId)?.username || viewerId} je komentarisao tvoju objavu #${postId}`
          );
        }
        return json(res, 201, c);
      }
    }

    const commentById = url.pathname.match(/^\/api\/engagement\/comments\/(\d+)$/);
    if (commentById) {
      const id = Number(commentById[1]);
      const viewerId = meId(req, url);
      const c = comments.find(x => x.id === id);
      if (!c) return json(res, 404, { error: "Komentar nije pronadjen" });
      if (c.authorId !== viewerId) return json(res, 403, { error: "Samo autor menja/brise komentar" });
      if (req.method === "PATCH") {
        const body = await readBody(req);
        c.text = String(body.text || c.text);
        c.updatedAt = new Date().toISOString();
        return json(res, 200, c);
      }
      if (req.method === "DELETE") {
        const i = comments.findIndex(x => x.id === id);
        comments.splice(i, 1);
        return json(res, 200, { deleted: true, id });
      }
    }

    const storyLikeRoute = url.pathname.match(/^\/api\/engagement\/stories\/(\d+)\/like$/);
    if (storyLikeRoute) {
      const storyId = Number(storyLikeRoute[1]);
      const viewerId = meId(req, url);
      const story = activeStories().find((x) => x.id === storyId);
      if (!story) return json(res, 404, { error: "Story nije pronadjen ili je istekao" });
      if (!canSeeUser(viewerId, story.authorId)) return json(res, 403, { error: "Nemate dozvolu za ovu akciju" });
      const key = `${viewerId}:${storyId}`;
      if (req.method === "POST") {
        storyLikes.add(key);
        if (story.authorId !== viewerId) {
          pushNotification(
            story.authorId,
            "story_like",
            `@${users.find(u => u.id === viewerId)?.username || viewerId} je lajkovao tvoj story #${storyId}`
          );
        }
        return json(res, 201, { liked: true, storyId, meId: viewerId, likesCount: Array.from(storyLikes).filter(k => Number(k.split(":")[1]) === storyId).length });
      }
      if (req.method === "DELETE") {
        storyLikes.delete(key);
        return json(res, 200, { liked: false, storyId, meId: viewerId, likesCount: Array.from(storyLikes).filter(k => Number(k.split(":")[1]) === storyId).length });
      }
    }

    const storyCommentsRoute = url.pathname.match(/^\/api\/engagement\/stories\/(\d+)\/comments$/);
    if (storyCommentsRoute) {
      const storyId = Number(storyCommentsRoute[1]);
      const viewerId = meId(req, url);
      const story = activeStories().find((x) => x.id === storyId);
      if (!story) return json(res, 404, { error: "Story nije pronadjen ili je istekao" });
      if (!canSeeUser(viewerId, story.authorId)) return json(res, 403, { error: "Nemate dozvolu za ovu akciju" });
      if (req.method === "GET") {
        const items = storyComments
          .filter((c) => c.storyId === storyId)
          .map((c) => ({ ...c, authorUsername: users.find((u) => u.id === c.authorId)?.username || "unknown" }));
        return json(res, 200, { items });
      }
      if (req.method === "POST") {
        const body = await readBody(req);
        const text = String(body.text || "").trim();
        if (!text) return json(res, 400, { error: "text je obavezan" });
        const c = { id: storyCommentSeq++, storyId, authorId: viewerId, text, createdAt: nowIso(), updatedAt: nowIso() };
        storyComments.push(c);
        if (story.authorId !== viewerId) {
          pushNotification(
            story.authorId,
            "story_comment",
            `@${users.find(u => u.id === viewerId)?.username || viewerId} je komentarisao tvoj story #${storyId}`
          );
        }
        return json(res, 201, c);
      }
    }

    const storyCommentById = url.pathname.match(/^\/api\/engagement\/story-comments\/(\d+)$/);
    if (storyCommentById) {
      const id = Number(storyCommentById[1]);
      const viewerId = meId(req, url);
      const c = storyComments.find((x) => x.id === id);
      if (!c) return json(res, 404, { error: "Story komentar nije pronadjen" });
      if (c.authorId !== viewerId) return json(res, 403, { error: "Samo autor menja/brise komentar" });
      if (req.method === "PATCH") {
        const body = await readBody(req);
        c.text = String(body.text || c.text);
        c.updatedAt = nowIso();
        return json(res, 200, c);
      }
      if (req.method === "DELETE") {
        const i = storyComments.findIndex((x) => x.id === id);
        storyComments.splice(i, 1);
        return json(res, 200, { deleted: true, id });
      }
    }

    // feed
    if (req.method === "GET" && url.pathname === "/api/feed") {
      const viewerId = meId(req, url);
      const followingAccepted = Array.from(follows.entries())
        .filter(([k, status]) => status === "accepted" && Number(k.split(":")[0]) === viewerId)
        .map(([k]) => Number(k.split(":")[1]));

      const items = posts
        .filter(p => followingAccepted.includes(p.authorId) && !isBlocked(viewerId, p.authorId))
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .map(p => {
          const author = users.find(u => u.id === p.authorId);
          const pv = makePostView(p);
          return {
            postId: pv.id,
            authorId: p.authorId,
            authorUsername: author?.username || "unknown",
            authorAvatarUrl: author?.avatar_url || "",
            caption: p.caption,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            likesCount: pv.likesCount,
            commentsCount: pv.commentsCount,
            media: p.media
          };
        });

      return json(res, 200, { items });
    }

    // media
    if (req.method === "POST" && url.pathname === "/api/media/upload") {
      const body = await readBody(req);
      const type = String(body.type || "").toLowerCase();
      const sizeMb = Number(body.sizeMb || 0);
      if (!["image", "video"].includes(type)) return json(res, 400, { error: "Dozvoljeni su samo image/video" });
      if (sizeMb <= 0 || sizeMb > 50) return json(res, 400, { error: "Maksimalna velicina fajla je 50MB" });
      return json(res, 201, {
        id: Date.now(),
        uploader_id: meId(req, url),
        media_type: type,
        original_name: String(body.originalName || "media.bin"),
        size_bytes: Math.round(sizeMb * 1024 * 1024),
        media_url: `mock://media/${Date.now()}`,
        created_at: new Date().toISOString()
      });
    }

    return json(res, 404, { error: "Ruta ne postoji" });
  } catch (err) {
    return json(res, 500, { error: "Server error", detail: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`quickstart mock API listening on ${PORT}`);
});

















