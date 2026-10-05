import type { Metadata } from "next";
import SharedWish from "./shared-wish";

export const metadata: Metadata = {
  title: "A wish for you | Wish Studio",
  description: "Someone made you a personal wish card.",
};

export default async function WishPage(props: PageProps<"/wish/[id]">) {
  const { id } = await props.params;
  return <SharedWish id={id} />;
}
