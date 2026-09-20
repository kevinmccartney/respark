import type { CardFace } from 'schemas/primitives';

export type CardFaceFields = {
  name: string;
  manaCost: string | null;
  typeLine: string | null;
  oracleText: string | null;
  imageSrc: string | null;
};

export const resolveCardFace = ({
  faces,
  faceIndex,
  name,
  manaCost,
  typeLine,
  oracleText,
  imageNormal,
  imageLarge,
  preferLarge = false,
}: {
  faces: readonly CardFace[];
  faceIndex: number;
  name: string;
  manaCost: string | null;
  typeLine: string | null;
  oracleText: string | null;
  imageNormal: string | null;
  imageLarge?: string | null;
  preferLarge?: boolean;
}): {
  displayed: CardFaceFields;
  canFlip: boolean;
  nextFaceName: string;
} => {
  const canFlip = faces.length > 1;
  const index = canFlip ? mod(faceIndex, faces.length) : 0;
  const face = canFlip ? faces[index] : undefined;
  const nextFace = canFlip ? faces[mod(index + 1, faces.length)] : undefined;
  const fallbackImage = preferLarge ? (imageLarge ?? imageNormal) : imageNormal;
  const faceImage = preferLarge
    ? (face?.imageLarge ?? face?.imageNormal)
    : (face?.imageNormal ?? face?.imageLarge);

  return {
    canFlip,
    nextFaceName: nextFace?.name ?? 'other face',
    displayed: {
      name: face?.name ?? name,
      manaCost: face ? face.manaCost : manaCost,
      typeLine: face?.typeLine ?? typeLine,
      oracleText: face ? face.oracleText : oracleText,
      imageSrc: faceImage ?? fallbackImage ?? null,
    },
  };
};

const mod = (value: number, n: number): number => ((value % n) + n) % n;
