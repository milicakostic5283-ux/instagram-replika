Write-Host "1) Register"
$register = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/register" -Method Post -ContentType "application/json" -Body '{"email":"student1@example.com","username":"student1","password":"123456","fullName":"Student One"}'
$meId = $register.user.id
Write-Host "Registered user id: $meId"

Write-Host "2) Login"
$login = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method Post -ContentType "application/json" -Body '{"login":"student1","password":"123456"}'
Write-Host "Access token received: $($null -ne $login.accessToken)"

Write-Host "3) Search user"
Invoke-RestMethod -Uri "http://localhost:8080/api/users/search?q=ana" -Method Get -Headers @{"X-User-Id"="$meId"}

Write-Host "4) Follow target 2"
Invoke-RestMethod -Uri "http://localhost:8080/api/social/follow/2" -Method Post -Headers @{"X-User-Id"="$meId"}

Write-Host "5) Create post"
$post = Invoke-RestMethod -Uri "http://localhost:8080/api/posts" -Method Post -Headers @{"X-User-Id"="$meId"} -ContentType "application/json" -Body '{"caption":"Moj prvi post","media":[{"type":"image","sizeMb":1.2,"url":"https://example.com/a.jpg"}]}'
$postId = $post.id
Write-Host "Post id: $postId"

Write-Host "6) Like post"
Invoke-RestMethod -Uri "http://localhost:8080/api/engagement/posts/$postId/like" -Method Post -Headers @{"X-User-Id"="$meId"}

Write-Host "7) Comment post"
$comment = Invoke-RestMethod -Uri "http://localhost:8080/api/engagement/posts/$postId/comments" -Method Post -Headers @{"X-User-Id"="$meId"} -ContentType "application/json" -Body '{"text":"Odlican post"}'
Write-Host "Comment id: $($comment.id)"

Write-Host "8) Feed"
Invoke-RestMethod -Uri "http://localhost:8080/api/feed" -Method Get -Headers @{"X-User-Id"="$meId"}

Write-Host "Smoke test zavrsen"
