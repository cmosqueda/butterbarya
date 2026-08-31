describe('Butterbarya payroll', () => {
  it('opens the SQLite-backed dashboard', () => {
    cy.visit('/')
    cy.contains('h1', 'Here’s your pay, at a glance.')
    cy.get('jeep-sqlite').should('exist')
    cy.contains('ion-tab-button', 'Time').click()
    cy.contains('h1', 'Log the workday.')
  })
})
