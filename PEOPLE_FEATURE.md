# People Feature - Face Detection & Recognition

This feature automatically detects faces in photos and organizes them by person, allowing users to browse photos by the people in them.

## How It Works

### 1. Face Detection

-   When photos are uploaded, the system automatically detects faces using the `@vladmandic/face-api` library
-   Face detection happens asynchronously and doesn't block the upload process
-   Each detected face is converted to a 128-dimensional face encoding (embedding) for comparison

### 2. Face Matching

-   When a face is detected, the system compares it against all previously detected faces for that user
-   Uses Euclidean distance to measure similarity between face encodings
-   If a match is found (distance < 0.6 threshold), the face is associated with the existing person
-   If no match is found, a new person profile is created

### 3. Person Profiles

-   Each unique person gets their own profile
-   The first photo containing the person becomes their thumbnail
-   Users can assign names to people (optional)
-   Users can view all photos containing a specific person

## Database Schema

### `people` table

-   Stores unique individuals detected in photos
-   Contains the representative face encoding for matching
-   Links to a thumbnail photo
-   Allows user-assigned names

### `face_detections` table

-   Records every face occurrence in photos
-   Stores bounding box coordinates
-   Links to both the photo and the person
-   Contains the specific face encoding for that occurrence

## API Endpoints

### `GET /api/people`

Get all people detected in the user's photos, sorted by photo count

### `GET /api/people/:id`

Get a specific person with all photos containing them

### `PATCH /api/people/:id`

Update a person's name

### `DELETE /api/people/:id`

Delete a person and all their face detection records

## Frontend Features

### People Page

-   Grid view of all detected people
-   Shows thumbnail and photo count for each person
-   Inline name editing
-   Delete person functionality

### Person Detail Page

-   Shows person's thumbnail and name (editable)
-   Displays all photos containing the person
-   Photo grid with lightbox viewer
-   Back navigation to people list

## Setup

### Face Detection Models

The face detection models are automatically downloaded during `npm install` via the postinstall script. To manually download them:

```bash
cd apps/backend
npm run download-models
```

Models are stored in `apps/backend/models/` and include:

-   SSD MobileNet v1 (face detection)
-   Face Landmark 68 (facial landmarks)
-   Face Recognition (face embeddings)

## Configuration

### Face Matching Threshold

The face matching threshold can be adjusted in `apps/backend/src/utils/faceDetection.ts`:

```typescript
export function findBestMatch(
    faceEncoding: number[],
    knownEncodings: Array<{ personId: number; encoding: number[] }>,
    threshold: number = 0.6 // Adjust this value
): number | null;
```

-   Lower threshold (e.g., 0.4): More strict matching, may create duplicate people
-   Higher threshold (e.g., 0.7): More lenient matching, may merge different people

## Performance Considerations

-   Face detection runs asynchronously and doesn't block photo uploads
-   Face detection adds ~1-3 seconds per photo depending on resolution
-   Models require ~20MB of disk space
-   Face encodings are stored as JSON strings in the database (small footprint)

## Future Enhancements

-   Manual face tagging and corrections
-   Merge/split person profiles
-   Face clustering improvements
-   Background processing queue for large batches
-   Person suggestions based on frequency
-   Face detection confidence threshold settings
