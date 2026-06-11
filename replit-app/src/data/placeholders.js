// ============================================================
// Placeholders — coming-soon catalog items (Chunk 8)
// ============================================================
// The JS mirror of ios/LusikSons/Data/Placeholders.swift (itself the
// mirror of the web CATALOG's status:"placeholder" entries — keys and
// copy verbatim). Not products: no checkout key, no price, no photos
// yet. `key` IS load-bearing — it's the product_key the /waitlist
// Function stores, and it must match the web catalog so the admin
// Notify sweep sees app + website signups as one list per product.
// `slug` matches the website's URL fragment for the same item.

export const PLACEHOLDERS = [
  {
    key: "towel-hand",
    slug: "embroidered-hand-towel",
    name: "The Embroidered Hand Towel",
    tagline: "Small enough to fit in a gift bag, made to outlive the wedding it was given at.",
    description:
      "A hand-sized soft towel with one of Lusik's hand-embroidered Armenian motifs — the pomegranate, the cross-hatch border, the small bird-and-tree pattern that has lived on Armenian linens for centuries. Folds into a gift bag for a housewarming, a hostess thank-you, a wedding. Sits in a guest bath the way an Armenian grandmother's linens always did — the small good thing on the shelf, waiting for the day someone notices it. Hand-embroidered by Lusik from her home in Southern California. Made to order, made to last.",
    categorySlug: "towels",
  },
  {
    key: "towel-baptism",
    slug: "armenian-baptism-towel",
    name: "The Armenian Baptism Towel",
    tagline: "The white towel godparents bring to the font — embroidered with your child's name, in Armenian, and the date of their baptism.",
    description:
      "By Armenian Apostolic Church canon, the godparents bring one large new white towel to the baptism. The priest uses it once — to lift the child out of the font — and from that day forward it belongs to the family. It goes into the chest with the christening dress, the cross from the priest, the photograph from the church steps. It comes out again at the next baptism, the wedding, sometimes the funeral, sometimes simply when the grandchildren ask to see it. Lusik embroiders the child's name in Armenian script, the baptism date, and an Armenian-style cross — by hand, the same way the towel her own godmother brought to her christening was made. From her home in Southern California. Made to order, made to last.",
    categorySlug: "towels",
  },
  {
    key: "baby-swaddle",
    slug: "baby-swaddle",
    name: "The Baby Swaddle",
    tagline: "The cloth a new baby is wrapped in for the going-home photograph — embroidered with their name.",
    description:
      "A soft swaddle for the earliest weeks — the cloth around the baby in the hospital photograph, the cloth on the first night in the crib, the cloth in the carrier walking through the front door of a house that just got fuller by one. Lusik embroiders the baby's name on it, in Armenian or English, the parents pick. A first object with a first name on it. Made to order by Lusik from her home in Southern California. Made to order, made to last.",
    categorySlug: "baby",
  },
  {
    key: "baby-bathrobe",
    slug: "baby-bathrobe",
    name: "The Baby Bathrobe",
    tagline: "The hooded towel that becomes every evening's anchor — with your child's name on the hood.",
    description:
      "A hooded terry bathrobe for the after-bath ritual — the wrap that comes out of the warm towel pile every evening for the first three years of a child's life, the wrap a parent's hands learn before the child can hold their own arms out. Lusik embroiders the child's name on the hood in Armenian or English. By the second year the child will be the one pointing at the letters, asking for them by sound. From Lusik's home in Southern California. Made to order, made to last.",
    categorySlug: "baby",
  },
];

export const placeholdersInCategory = (slug) => PLACEHOLDERS.filter((p) => p.categorySlug === slug);
export const findPlaceholder = (categorySlug, slug) =>
  PLACEHOLDERS.find((p) => p.categorySlug === categorySlug && p.slug === slug) ?? null;
