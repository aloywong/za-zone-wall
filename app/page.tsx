'use client';

import { useEffect, useState } from 'react';
import heic2any from 'heic2any';
import { supabase } from '@/lib/supabase';

const TAGS = [
  {
    value: 'zone_mate',
    label: 'Rave & Brag about a Zone-mate',
    bg: '#FACC15',
    text: '#222222'
  },
  {
    value: 'dreams',
    label: 'Dreams for ZA Zone',
    bg: '#EF4444',
    text: '#FFFFFF'
  },
  {
    value: 'memory',
    label: 'Your favourite ZA Zone memory',
    bg: '#3B82F6',
    text: '#FFFFFF'
  }
];

type Post = {
  id: string;
  username: string;
  tag: string;
  caption: string;
  image_url: string;
  created_at: string;
};

export default function HomePage() {
  const [username, setUsername] = useState('');
  const [tag, setTag] = useState('');
  const [caption, setCaption] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);

  async function fetchPosts() {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setPosts(data || []);
  }

  useEffect(() => {
    fetchPosts();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!username || !tag || !caption || !imageFile) {
      alert('Please fill in all fields, including an image.');
      return;
    }

    try {
      setLoading(true);

      let selectedFile: File | Blob = imageFile;
      let mimeType = imageFile.type.toLowerCase();
      let fileExt = 'jpg';

      if (!mimeType.startsWith('image/')) {
        alert('Please upload a valid image file.');
        return;
      }

      if (mimeType.includes('heic') || mimeType.includes('heif')) {
        const convertedBlob = await heic2any({
          blob: imageFile,
          toType: 'image/jpeg',
          quality: 0.9
        });

        const finalBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
        selectedFile = finalBlob ?? imageFile;
        mimeType = 'image/jpeg';
        fileExt = 'jpg';
      } else if (mimeType.includes('png')) {
        fileExt = 'png';
      } else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
        fileExt = 'jpg';
      } else if (mimeType.includes('webp')) {
        fileExt = 'webp';
      } else {
        alert('Please upload a JPG, JPEG, PNG, WEBP, or HEIC image.');
        return;
      }

      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('wall-images')
        .upload(filePath, selectedFile, {
          contentType: mimeType,
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('wall-images')
        .getPublicUrl(filePath);

      const imageUrl = publicUrlData.publicUrl;

      const { error: insertError } = await supabase.from('posts').insert([
        {
          username,
          tag,
          caption,
          image_url: imageUrl
        }
      ]);

      if (insertError) throw insertError;

      setUsername('');
      setTag('');
      setCaption('');
      setImageFile(null);

      await fetchPosts();
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

  return (
    <main className="relative min-h-screen overflow-hidden text-gray-900">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source src="/bg-video.mp4" type="video/mp4" />
      </video>

      <div className="relative z-10 p-6">
        <div className="mx-auto max-w-6xl">
          <h1 className="mb-6 text-4xl font-bold text-gray-900">Dear ZA</h1>

          <div className="mb-10 rounded-2xl bg-white/90 p-6 shadow">
            <h2 className="mb-4 text-3xl font-semibold text-gray-900">
              Launch a memory to the wall
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
                        borderColor: item.bg
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

              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
                onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-900"
              />

              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-black px-5 py-3 text-white disabled:opacity-50"
              >
                {loading ? 'Launching...' : 'Launch to Wall'}
              </button>
            </form>
          </div>

          <section>
            <h2 className="mb-4 text-3xl font-semibold text-white">Wall</h2>

            {posts.length === 0 ? (
              <p className="text-gray-700">No posts yet. Be the first to launch one!</p>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {posts.map((post) => {
                  const tagInfo = getTagInfo(post.tag);

                  return (
                    <div
                      key={post.id}
                      className="overflow-hidden rounded-2xl bg-white/95 shadow"
                      style={{ borderTop: `10px solid ${tagInfo.bg}` }}
                    >
                      <img
                        src={post.image_url}
                        alt={post.caption}
                        className="h-64 w-full object-cover"
                      />

                      <div className="p-4">
                        <span
                          className="mb-3 inline-block rounded-full px-3 py-1 text-sm font-semibold"
                          style={{
                            backgroundColor: tagInfo.bg,
                            color: tagInfo.text
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
