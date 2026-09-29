import { describe, expect, it } from "vitest";
import {
  EMPTY_REPORT_FORM,
  REPORT_FORM_ERRORS,
  validateReportForm,
  type ReportFormValues,
} from "./reportForm";

/** A form with everything filled in correctly — each test spoils one field. */
function validForm(): ReportFormValues {
  return {
    owner: {
      name: "عبدالله الحربي",
      nationalId: "1023837857",
      mobile: "0555123456",
      email: "owner@gmail.com",
    },
    property: { use: "سكني", siteContents: "فيلا سكنية" },
    office: { engineerName: "م. سامي", managerName: "م. خالد" },
    borders: { north: "شارع 15م", south: "جار", east: "شارع 20م", west: "جار" },
    photos: ["data:image/jpeg;base64,AA", "data:image/jpeg;base64,BB", "data:image/jpeg;base64,CC"],
  };
}

describe("report form validation", () => {
  it("accepts a fully and correctly filled form", () => {
    expect(validateReportForm(validForm())).toEqual({});
  });

  it("reports every missing field at once, not just the first", () => {
    const errors = validateReportForm(EMPTY_REPORT_FORM);

    // owner name/id/mobile/email + use + engineer + manager + four borders + three photos = 14
    expect(Object.keys(errors)).toHaveLength(14);
    expect(errors["photos.2"]).toBe(REPORT_FORM_ERRORS.photo);
    expect(errors["property.use"]).toBe(REPORT_FORM_ERRORS.required);
    expect(errors["owner.name"]).toBe(REPORT_FORM_ERRORS.required);
    expect(errors["borders.north"]).toBe(REPORT_FORM_ERRORS.required);
  });

  describe("email", () => {
    it.each(["owner@hotmail.com", "owner@gmail.net", "owner@gmailxcom", "owner@GMAIL.CO"])(
      "rejects %s",
      (email) => {
        const values = validForm();
        values.owner.email = email;
        expect(validateReportForm(values)["owner.email"]).toBe(REPORT_FORM_ERRORS.email);
      },
    );

    it.each(["owner@gmail.com", "Owner.Name@Gmail.Com"])("accepts %s", (email) => {
      const values = validForm();
      values.owner.email = email;
      expect(validateReportForm(values)["owner.email"]).toBeUndefined();
    });
  });

  describe("national id", () => {
    it.each(["3023837857", "102383785", "10238378570", "10238a7857"])(
      "rejects %s",
      (nationalId) => {
        const values = validForm();
        values.owner.nationalId = nationalId;
        expect(validateReportForm(values)["owner.nationalId"]).toBe(
          REPORT_FORM_ERRORS.nationalId,
        );
      },
    );

    it.each(["1023837857", "2289856805"])("accepts %s", (nationalId) => {
      const values = validForm();
      values.owner.nationalId = nationalId;
      expect(validateReportForm(values)["owner.nationalId"]).toBeUndefined();
    });
  });

  describe("mobile", () => {
    it.each(["0455123456", "055512345", "05551234567", "555123456"])(
      "rejects %s",
      (mobile) => {
        const values = validForm();
        values.owner.mobile = mobile;
        expect(validateReportForm(values)["owner.mobile"]).toBe(REPORT_FORM_ERRORS.mobile);
      },
    );

    it("accepts a 05 number of ten digits", () => {
      const values = validForm();
      values.owner.mobile = "0501234567";
      expect(validateReportForm(values)["owner.mobile"]).toBeUndefined();
    });
  });

  it("treats a field of spaces as empty", () => {
    const values = validForm();
    values.owner.name = "   ";
    values.borders.east = "  ";

    const errors = validateReportForm(values);
    expect(errors["owner.name"]).toBe(REPORT_FORM_ERRORS.required);
    expect(errors["borders.east"]).toBe(REPORT_FORM_ERRORS.required);
  });

  it("requires a border for every direction", () => {
    for (const direction of ["north", "south", "east", "west"] as const) {
      const values = validForm();
      values.borders[direction] = "";
      expect(validateReportForm(values)[`borders.${direction}`]).toBe(
        REPORT_FORM_ERRORS.required,
      );
    }
  });

  it("requires every one of the three building photos", () => {
    for (const index of [0, 1, 2] as const) {
      const values = validForm();
      values.photos[index] = "";
      const errors = validateReportForm(values);
      expect(errors[`photos.${index}`]).toBe(REPORT_FORM_ERRORS.photo);
      expect(Object.keys(errors)).toHaveLength(1);
    }
  });

  it("requires الاستخدام", () => {
    const values = validForm();
    values.property.use = "  ";
    expect(validateReportForm(values)["property.use"]).toBe(REPORT_FORM_ERRORS.required);
  });

  it("leaves مشتملات الموقع optional", () => {
    const values = validForm();
    values.property.siteContents = "";
    expect(validateReportForm(values)).toEqual({});
  });
});
