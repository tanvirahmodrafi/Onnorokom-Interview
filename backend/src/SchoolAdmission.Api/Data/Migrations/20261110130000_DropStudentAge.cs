using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SchoolAdmission.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class DropStudentAge : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "student_age",
                table: "holds");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // The ages are gone; restored rows get the same placeholder as the earlier backfill.
            migrationBuilder.AddColumn<int>(
                name: "student_age",
                table: "holds",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }
    }
}
