'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const TAGS = [
  {
    value: 'zone_mate',
    label: 'Rave & Brag about a Zonemate',
    bg: '#FACC15',
    text: '#222222',
  },
  {
    value: 'dreams',
    label: 'Dreams for ZA Zone',
    bg: '#EF4444',
    text: '#FFFFFF',
  },
  {
    value: 'memory',
    label: 'Your favourite ZA Zone memory',
    bg: '#3B82F6',
    text: '#FFFFFF',
  },
];

const TABS = [{ value: 'all', label: 'All', bg: '#000000', text: '#FFFFFF' }, ...TAGS];

type Post = {
  id: string;
  username: string;
  tag: string;
  caption: string;
  media_path: string | null;
  media_type: 'image' | 'video' | null;
  created_at: string;
};

export default function HomePage() {
  const [username, setUsername] = useState('');
  const [tag, setTag] = useState('');
  const [caption, setCaption] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<string>('all');

  async function fetchPosts() {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching posts:', error);
      return;
    }

    setPosts((data as Post[]) || []);
  }

  async function fetchSignedUrls(paths: string[]) {
    if (paths.length === 0) return;

    const res = await fetch('/api/signed-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
    });

    const { urls } = await res.json();

    setSignedUrls((prev) => ({ ...prev, ...urls }));
  }

  useEffect(() => {
    fetchPosts();
    const channel = supabase
      .channel('posts-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        (payload) => {
          setPosts((prev) => [payload.new as Post, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
  const pathsNeeded = posts
    .map((p) => p.media_path)
    .filter((path): path is string => !!path && !signedUrls[path]);

  if (pathsNeeded.length > 0) {
    fetchSignedUrls(pathsNeeded);
  }
  }, [posts, signedUrls]);

  function getFileInfo(file: File) {
    const fileName = (file.name || '').toLowerCase();
    const rawType = (file.type || '').toLowerCase();

    const extMatch = fileName.match(/\.([a-z0-9]+)$/);
    const ext = extMatch ? extMatch[1] : '';

    const isVideoExt = ['mp4', 'mov', 'webm', 'm4v', 'avi', '3gp', 'mkv'].includes(ext);
    const isImageExt = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif'].includes(ext);

    let mediaType: 'image' | 'video' = 'image';

    if (rawType.startsWith('video/') || isVideoExt) {
      mediaType = 'video';
    } else if (rawType.startsWith('image/') || isImageExt) {
      mediaType = 'image';
    }

    return { ext, rawType, mediaType };
  }

    async function handleSubmit(e: React.FormEvent) {
      e.preventDefault();

      if (!username || !tag || !caption) {
        alert('Please fill in your nickname, category, and caption.');
        return;
      }

      try {
        setLoading(true);

        let mediaPath = '';
        let mediaType: 'image' | 'video' = 'image';

        if (mediaFile) {
          const file = mediaFile;
          const { ext, rawType, mediaType: detectedType } = getFileInfo(file);
          mediaType = detectedType;

          let selectedFile: File | Blob = file;
          let contentType = rawType;
          let extension = 'jpg';

          if (mediaType === 'video') {
            if (rawType.includes('webm') || ext === 'webm') {
              extension = 'webm';
              contentType = contentType || 'video/webm';
            } else if (rawType.includes('quicktime') || ext === 'mov') {
              extension = 'mov';
              contentType = contentType || 'video/quicktime';
            } else {
              extension = 'mp4';
              contentType = contentType || 'video/mp4';
            }
          } else {
            const isHeic =
              rawType.includes('heic') ||
              rawType.includes('heif') ||
              ext === 'heic' ||
              ext === 'heif';

            if (isHeic) {
              const heic2anyLib = (await import('heic2any')).default;

              const converted = await heic2anyLib({
                blob: file,
                toType: 'image/jpeg',
                quality: 0.85,
              });

              const blob = Array.isArray(converted) ? converted[0] : converted;

              if (!blob) {
                throw new Error('HEIC image conversion failed.');
              }

              selectedFile = blob;
              contentType = 'image/jpeg';
              extension = 'jpg';
            } else if (rawType.includes('png') || ext === 'png') {
              contentType = 'image/png';
              extension = 'png';
            } else if (rawType.includes('webp') || ext === 'webp') {
              contentType = 'image/webp';
              extension = 'webp';
            } else {
              contentType = 'image/jpeg';
              extension = 'jpg';
            }
          }

          if (!contentType) {
            contentType = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
          }

          const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
          const filePath = `posts/${uniqueId}.${extension}`;

          const { error: uploadError } = await supabase.storage
            .from('wall-images')
            .upload(filePath, selectedFile, {
              contentType,
              upsert: false,
            });

          if (uploadError) {
            console.error('Supabase Upload Error:', uploadError);
            throw uploadError;
          }

          mediaPath = filePath;
        }

        const { error: insertError } = await supabase.from('posts').insert([
          {
            username,
            tag,
            caption,
            media_path: mediaPath || null,
            media_type: mediaFile ? mediaType : null,
          },
        ]);

        if (insertError) {
          console.error('Supabase Insert Error:', insertError);
          throw insertError;
        }

        setUsername('');
        setTag('');
        setCaption('');
        setMediaFile(null);

        alert('Uploaded successfully!');
      } catch (err: any) {
        console.error(err);
        alert(err?.message || 'Something went wrong while uploading.');
      } finally {
        setLoading(false);
      }
} 
  function getTagInfo(tagValue: string) {
    return TAGS.find((t) => t.value === tagValue) ?? TAGS[0];
  }

  const filteredPosts =
    activeTab === 'all' ? posts : posts.filter((post) => post.tag === activeTab);

  return (
    <main className="relative min-h-screen overflow-hidden text-gray-900">
      <video
        autoPlay
        loop
        muted
        playsInline
        aria-hidden="true"
        className="fixed inset-0 h-full w-full object-cover object-center select-none"
      >
        <source src="/bg-video.mp4" type="video/mp4" />
      </video>

      <div className="relative z-10 inset-0 bg-transparent p-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 rounded-2xl bg-white/90 p-6 shadow">
            <h2 className="mb-4 text-3xl font-semibold text-gray-900">
              Launch to the wall!
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="Enter your nickname"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-900 placeholder-gray-400"
              />

              <div>
                <p className="mb-2 text-lg font-medium text-gray-900">Choose a category</p>
                <div className="flex flex-col gap-3 md:flex-row">
                  {TAGS.map((item) => (
                    <button
                      type="button"
                      key={item.value}
                      onClick={() => setTag(item.value)}
                      className="rounded-xl border p-4 text-left text-lg transition"
                      style={{
                        backgroundColor: tag === item.value ? item.bg : '#ffffff',
                        color: tag === item.value ? item.text : '#111827',
                        borderColor: item.bg,
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                placeholder="Write your caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-900 placeholder-gray-400"
                rows={4}
              />

              <div>
                <label
                  htmlFor="media-upload"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Upload Photo or Video (JPG, PNG, HEIC, MP4, MOV, WEBM)
                </label>
                <input
                  id="media-upload"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.mp4,.mov,.webm,image/*,video/*"
                  onChange={(e) => setMediaFile(e.target.files?.[0] ?? null)}
                  className="block w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-900"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-black px-5 py-3 text-white disabled:opacity-50"
              >
                {loading ? 'Launching...' : 'Launch to Wall!'}
              </button>
            </form>
          </div>

          <section>
            <h2 className="mb-4 text-3xl font-semibold text-white">Wall</h2>
            <div className="mb-6 flex flex-wrap gap-3">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setActiveTab(t.value)}
              className="rounded-full border px-4 py-2 text-sm font-semibold transition"
              style={{
                backgroundColor: activeTab === t.value ? t.bg : '#ffffff',
                color: activeTab === t.value ? t.text : '#111827',
                borderColor: t.bg,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
            {filteredPosts.length === 0 ? (
              <p className="text-gray-700">No posts yet. Be the first to launch one!</p>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredPosts.map((post) => {
            const tagInfo = getTagInfo(post.tag);
            const mediaSource = post.media_path ? signedUrls[post.media_path] : null;

            const isVideo =
              post.media_type === 'video' ||
              /\.(mp4|mov|webm|m4v|3gp)$/i.test(post.media_path || '');

                  return (
                    <div
                      key={post.id}
                      className="overflow-hidden rounded-2xl bg-white/95 shadow"
                      style={{ borderTop: `10px solid ${tagInfo.bg}` }}
                    >
                      {mediaSource ? (
                      isVideo ? (
                     <video
                      src={mediaSource}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="h-64 w-full object-cover"
                      />
                    ) : (
                      <img
                        src={mediaSource}
                        alt={post.caption}
                        className="h-64 w-full object-cover"
                      />
                    )
                  ) : null}

                      <div className="p-4">
                        <span
                          className="mb-3 inline-block rounded-full px-3 py-1 text-sm font-semibold"
                          style={{
                            backgroundColor: tagInfo.bg,
                            color: tagInfo.text,
                          }}
                        >
                          {tagInfo.label}
                        </span>

                        <p className="mb-2 text-gray-800">{post.caption}</p>
                        <p className="text-sm text-gray-500">by {post.username}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
