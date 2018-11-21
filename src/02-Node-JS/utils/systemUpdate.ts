import { Item, ListItemFormUpdateValue, PermissionKind } from '@pnp/sp';
import { format } from 'date-fns';

export const dateToFormString = (dateTime: Date | string): string => {
  return format(dateTime, 'M/D/YYYY h:m A');
};

export const loginToFormString = (userName: string): string => {
  return JSON.stringify([{ Key: userName, IsResolved: true }]);
};

export const systemUpdate = async (item: Item, formUpdateValues: ListItemFormUpdateValue[]) => {

  const permissions = await item.getCurrentUserEffectivePermissions();
  if (!item.hasPermissions(permissions, PermissionKind.ManagePermissions)) {
    throw new Error('403 - Access denied. Full Control permissions level is required for performing this operation.');
  }

  const { Editor: { Name }, Modified } = await item.select('Modified,Editor/Name').expand('Editor').get();

  const modifiedDate = new Date(Modified); // addMinutes(new Date(Modified), new Date().getTimezoneOffset()); // Depends on Web timezone

  const sysUpdateData = [
    { FieldName: 'Editor', FieldValue: loginToFormString(Name) },
    { FieldName: 'Modified', FieldValue: dateToFormString(modifiedDate) }
  ];

  const result = await item.configure({
    headers: {
      Accept: 'application/json;odata=minimalmetadata'
    }
  }).validateUpdateListItem(formUpdateValues.concat(sysUpdateData), true);

  const errors = result
    .filter(field => field.ErrorMessage !== null)
    .filter(field => {
      return !(field.FieldName === 'Editor' && field.ErrorMessage === 'Multiple entries matched, please click to resolve.');
    });
  if (errors.length > 0) {
    throw new Error(JSON.stringify(errors));
  }

  return result;

};
