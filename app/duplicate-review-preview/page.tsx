import { notFound } from "next/navigation";
import { PostUploadPhotoReview, type PhotoMatch } from "@/components/PostUploadPhotoReview";

function placeholder(label: string, first: string, second: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${first}"/><stop offset="1" stop-color="${second}"/></linearGradient></defs><rect width="1200" height="900" fill="url(#g)"/><circle cx="600" cy="365" r="165" fill="rgba(255,255,255,.18)"/><path d="M270 820c42-220 172-330 330-330s288 110 330 330" fill="rgba(255,255,255,.14)"/><text x="600" y="855" fill="rgba(255,255,255,.86)" text-anchor="middle" font-family="Georgia" font-size="34">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const demoMatches: PhotoMatch[] = [{
  id: "11111111-1111-4111-8111-111111111111",
  confidence: 0.9688,
  mine: {
    mediaId: "22222222-2222-4222-8222-222222222222",
    name: "sandi-and-jenny-summer.jpg",
    width: 4032,
    height: 3024,
    bytes: 4_720_640,
    src: placeholder("Your photograph", "#a65170", "#e6ad78")
  },
  collection: {
    mediaId: "33333333-3333-4333-8333-333333333333",
    name: "family-album-summer.jpg",
    width: 2048,
    height: 1536,
    bytes: 1_572_864,
    src: placeholder("In the collection", "#714c78", "#d29478")
  }
}];

export default function DuplicateReviewPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="duplicatePreviewPage">
      <section className="contributionSuccess" aria-label="Contribution success preview">
        <span className="successMark">✓</span>
        <span className="eyebrow">YOUR MEMORY ARRIVED</span>
        <h2>Thank you for becoming part of Sandi’s story.</h2>
        <p>Your written memory and photographs have been received, verified, and backed up in private storage.</p>
        <p className="confirmationCode">Confirmation: 8A11SAND</p>
        <PostUploadPhotoReview submissionId="preview" reviewToken={null} demoMatches={demoMatches} />
        <button className="secondary" type="button">Share another memory</button>
      </section>
    </main>
  );
}
