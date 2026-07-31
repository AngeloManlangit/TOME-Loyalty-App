import { COLLECTIONS } from '../../config';
import { db } from '../../firebase';



export interface MerchantDoc {
  name: string;
  brand_id?: number;
  active: boolean;
}

function merchants() {
  return db().collection(COLLECTIONS.merchants);
}

/** Normalize a TIN to the document ID form: digits only, so dash grouping cannot cause a miss. */
export function tinToDocId(tin: string): string {
  return tin.replace(/[^0-9]/g, '');
}

export async function isAccredited(tin: string | undefined): Promise<boolean> {
  // Whitelist empty => everything passes. Checked first so an unreadable TIN is not penalised while
  // accreditation is effectively off.
  const any = await merchants().limit(1).get();
  if (any.empty) return true;

  if (!tin) return false;

  const snap = await merchants().doc(tinToDocId(tin)).get();
  if (!snap.exists) return false;

  return (snap.data() as MerchantDoc).active === true;
}
