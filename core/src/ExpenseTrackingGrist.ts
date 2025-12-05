export namespace grist {
  export type Text = string
  export type Numeric = number
  export type Int = number
  export type Bool = boolean
  export type Date = number
  export type DateTime = string
  export type Choice = string
  export type Reference = number
  export type ReferenceList = ['L', ...number[]] | null
  export type ChoiceList = ['L', ...string[]] | null
  export type Attachments = ['L', ...number[]] | null
  export type Any = any
}

export type ExpenseTrackingGristTables = {
  Daily_Expenses: {
    id: number
    Date: grist.Date
    Amount: grist.Numeric
    Category: grist.Choice
    Beneficiary: grist.Choice
    Note: grist.Text
    Occasion: grist.Bool
    Month: grist.Any // calculated/formula
    Daily_Amount: grist.Numeric // calculated/formula
  }
}
