// Public, predictable demo key. Never use this key to protect real information.
const demo_key = Uint8Array.from({ length: 32 }, (_, index) => index);

function isBytes(value) {
	return (
		Array.isArray(value) &&
		value.every(
			(byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255,
		)
	);
}

export async function initialize(saver, { signal }) {
	const key = await crypto.subtle.importKey(
		'raw',
		demo_key,
		'AES-GCM',
		false,
		['encrypt', 'decrypt'],
	);
	if (signal.aborted) return;
	const encoder = new TextEncoder();
	const decoder = new TextDecoder();

	saver.beforeSave = async (state) => {
		const iv = crypto.getRandomValues(new Uint8Array(12));
		const ciphertext = await crypto.subtle.encrypt(
			{ name: 'AES-GCM', iv },
			key,
			encoder.encode(JSON.stringify(state)),
		);
		return {
			version: 1,
			algorithm: 'AES-GCM',
			iv: Array.from(iv),
			ciphertext: Array.from(new Uint8Array(ciphertext)),
		};
	};

	saver.beforeRestore = async (payload) => {
		if (
			payload?.version !== 1 ||
			payload.algorithm !== 'AES-GCM' ||
			!isBytes(payload.iv) ||
			payload.iv.length !== 12 ||
			!isBytes(payload.ciphertext) ||
			payload.ciphertext.length < 16
		) {
			throw new TypeError('Unsupported encrypted draft format.');
		}
		const plaintext = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: new Uint8Array(payload.iv) },
			key,
			new Uint8Array(payload.ciphertext),
		);
		return JSON.parse(decoder.decode(plaintext));
	};
}
