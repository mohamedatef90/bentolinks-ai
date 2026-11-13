-- Repair only URLs that unambiguously identify one social post/video. Social
-- homepages, profiles, ads/business tools and company pages stay Bookmarks.
update public.content_items
set kind_override = 'content'
where item_kind = 'bookmark'
  and (
    url ~* 'https?://([^/]+\.)?(facebook\.com|fb\.com)/(share/(r|p|v|s)(/|\?)|reel/|watch(/|\?)|[^?#]+/(posts|videos)/|photo|permalink\.php|story\.php)'
    or url ~* 'https?://([^/]+\.)?fb\.watch/'
    or url ~* 'https?://([^/]+\.)?instagram\.com/(reel|reels|p|tv|share/(reel|p))/'
    or url ~* 'https?://([^/]+\.)?tiktok\.com/.+/(video|photo)/'
    or url ~* 'https?://(vm|vt)\.tiktok\.com/'
    or url ~* 'https?://([^/]+\.)?(twitter|x)\.com/[^/]+/status/'
    or url ~* 'https?://([^/]+\.)?reddit\.com/r/[^/]+/comments/'
    or url ~* 'https?://([^/]+\.)?threads\.net/@[^/]+/post/'
    or url ~* 'https?://([^/]+\.)?linkedin\.com/(posts|pulse|feed/update)/'
  );
