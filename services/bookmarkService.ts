
export interface ParsedBookmark {
  url: string;
  title: string;
  addDate?: number;
}

export const parseBookmarksHTML = (htmlContent: string): ParsedBookmark[] => {
  const bookmarks: ParsedBookmark[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  const links = doc.querySelectorAll('a');

  links.forEach((link) => {
    const url = link.getAttribute('href');
    const title = link.textContent || 'Untitled';
    const addDate = link.getAttribute('add_date');

    if (url && url.startsWith('http')) {
      bookmarks.push({
        url,
        title,
        addDate: addDate ? parseInt(addDate) * 1000 : undefined
      });
    }
  });

  return bookmarks;
};
