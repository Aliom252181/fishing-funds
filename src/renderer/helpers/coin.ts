import * as Services from '@/services';
import * as Enums from '@/utils/enums';
import * as Utils from '@/utils';

export async function GetCoin(code: string) {
  return Services.Coin.GetDetailFromCoingecko(code);
}
export async function GetCoins(config: Coin.SettingItem[], unit: Enums.CoinUnitType) {
  const ids = config.map(({ code }) => code).join(',');
  const list = await Services.Coin.FromCoingecko(ids, unit);
  return list.filter(Utils.NotEmpty);
}
