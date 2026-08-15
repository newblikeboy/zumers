# Backend API

Base path:

```text
/api/v1
```

## Authentication

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/signup` | No | Create an 18+ individual user account |
| POST | `/auth/login` | No | Log in |
| POST | `/auth/refresh` | No | Rotate refresh token and issue a new access token |
| POST | `/auth/logout` | Yes | Revoke a refresh token |
| GET | `/me` | Yes | Return current user and profile |

Signup body:

```json
{
  "email": "person@example.com",
  "password": "password123",
  "date_of_birth": "1998-04-15",
  "display_name": "Maya Rao",
  "username": "maya"
}
```

Login body:

```json
{
  "email": "person@example.com",
  "password": "password123"
}
```

Refresh/logout body:

```json
{
  "refresh_token": "opaque-refresh-token"
}
```

## Profiles

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/users/search?q=maya` | Yes | Search active users |
| GET | `/users/{id}` | Yes | View a profile |
| PATCH | `/me/profile` | Yes | Update own profile |

## Friends

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/friends/requests` | Yes | Send a friend request |
| GET | `/friends/requests` | Yes | List incoming friend requests |
| GET | `/friends/requests?direction=outgoing` | Yes | List outgoing friend requests |
| POST | `/friends/requests/{id}/accept` | Yes | Accept request |
| POST | `/friends/requests/{id}/reject` | Yes | Reject request |
| GET | `/friends` | Yes | List friends |
| DELETE | `/friends/{id}` | Yes | Unfriend |

## Posts

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/posts` | Yes | Create text/media post |
| GET | `/feed` | Yes | View own, friend, and public posts |
| GET | `/users/{id}/posts` | Yes | View visible posts by one user |
| PATCH | `/posts/{id}` | Yes | Edit own post |
| DELETE | `/posts/{id}` | Yes | Soft-delete own post |
| POST | `/posts/{id}/reactions` | Yes | Like/react to a post |
| DELETE | `/posts/{id}/reactions` | Yes | Remove own reaction |
| GET | `/posts/{id}/comments` | Yes | List comments |
| POST | `/posts/{id}/comments` | Yes | Add comment |
| DELETE | `/comments/{id}` | Yes | Delete own comment |
| POST | `/posts/{id}/share` | Yes | Share/repost a visible post |

Reaction body:

```json
{
  "reaction_type": "like"
}
```

Comment body:

```json
{
  "content": "Nice post"
}
```

Share body:

```json
{
  "content": "Sharing this",
  "visibility": "friends"
}
```

## Media

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/media/sign-upload` | Yes | Create a Cloudinary signed upload payload |

Cloudinary signing requires these env vars:

```env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_UPLOAD_FOLDER=zumers-dev
CLOUDINARY_MAX_IMAGE_BYTES=10485760
CLOUDINARY_MAX_VIDEO_BYTES=209715200
CLOUDINARY_MAX_VIDEO_SECONDS=300
```

The signed upload response includes allowed MIME prefixes and max upload limits. The frontend validates images/videos before upload, shows progress, and only creates posts after Cloudinary returns successful metadata.

## Chat

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/conversations` | Yes | List conversations |
| POST | `/conversations` | Yes | Create or return a friend conversation |
| GET | `/conversations/{id}/messages` | Yes | List message history |
| POST | `/conversations/{id}/messages` | Yes | Send a message |
| POST | `/conversations/{id}/read` | Yes | Mark received messages as read |
| WS | `/ws/chat?access_token=...` | Access token query | Real-time chat events |

Create conversation body:

```json
{
  "friend_id": 2
}
```

Send message body:

```json
{
  "message_type": "text",
  "content": "Hello"
}
```

WebSocket send event:

```json
{
  "type": "message.send",
  "conversation_id": 1,
  "message_type": "text",
  "content": "Hello"
}
```

WebSocket read event:

```json
{
  "type": "conversation.read",
  "conversation_id": 1
}
```

## Notifications

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/notifications` | Yes | List notifications |
| POST | `/notifications/{id}/read` | Yes | Mark notification as read |
