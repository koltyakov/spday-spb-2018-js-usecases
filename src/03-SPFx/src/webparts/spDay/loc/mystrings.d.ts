declare interface ISPDayWebPartStrings {
  PropertyPaneDescription: string;
  BasicGroupName: string;
  TitleFieldLabel: string;
  RefreshFieldLabel: string;
}

declare module 'SPDayWebPartStrings' {
  const strings: ISPDayWebPartStrings;
  export = strings;
}
